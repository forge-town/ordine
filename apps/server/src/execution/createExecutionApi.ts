import { Hono, type Context } from "hono";
import { z } from "zod/v4";
import { ok, type ResultAsync } from "neverthrow";
import type { ExecutionApiService } from "@repo/services";
import {
  ExecutionRuntimeConfigRecordSchema,
  ExecutionWorkspaceSettingsRecordSchema,
  SaveExecutionRuntimeConfigSchema,
  SaveExecutionWorkspaceSettingsSchema,
  ImportExecutionInputSchema,
  EXECUTION_MAX_INPUT_ASSET_BYTES,
  ExecutionApprovalSchema,
  ExecutionArtifactSchema,
  ExecutionEventSchema,
  ExecutionIdentifierSchema,
  ExecutionInputAssetSchema,
  ExecutionJobControlSchema,
  ExecutionJobResultSchema,
  ExecutionJobSchema,
  ExecutionJobSummarySchema,
  ExecutionRequestIdSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  SaveOperationRevisionSchema,
  SavePipelineDefinitionSchema,
  type ExecutionError,
  type ExecutionPrincipal,
  type ExecutionScope,
} from "@repo/schemas";
import {
  createExecutionAuthMiddleware,
  type ExecutionAuthEnv,
  type ExecutionAuthOptions,
} from "./auth";
import { createExecutionCorsMiddleware } from "./cors";
import { createExecutionReadinessHandler } from "./readiness";
import { executionError, executionErrorStatus, publicExecutionError } from "./errors";
import { INPUT_ASSET_JSON_MAX_BYTES, readExecutionJson } from "./body";
import { executionNotFound } from "./versionBoundary";

const empty = z.strictObject({});
const id = z.strictObject({ id: ExecutionIdentifierSchema });
const integerQuery = (minimum: number, maximum: number, defaultValue: string) =>
  z
    .string()
    .regex(/^(?:0|[1-9]\d*)$/u)
    .default(defaultValue)
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));
const envelope = <B extends z.ZodType>(body: B) =>
  z.strictObject({ params: empty, query: empty, body });
const identified = <B extends z.ZodType>(body: B) =>
  z.strictObject({ params: id, query: empty, body });
const ImportInputSchema = ImportExecutionInputSchema.refine((input) => {
  const bytes = Buffer.from(input.contentBase64, "base64");

  return (
    bytes.byteLength <= EXECUTION_MAX_INPUT_ASSET_BYTES &&
    bytes.toString("base64") === input.contentBase64
  );
}, "Input must be canonical base64 and at most 8 MiB");
const ArtifactRangeSchema = z.strictObject({
  metadata: z.union([ExecutionArtifactSchema, ExecutionInputAssetSchema]),
  bytes: z.instanceof(Uint8Array),
  offset: z.number().int().nonnegative(),
  totalSizeBytes: z.number().int().nonnegative(),
});

export type ExecutionApiOptions = {
  service: ExecutionApiService;
  auth: ExecutionAuthOptions;
  readiness: Parameters<typeof createExecutionReadinessHandler>[0];
};

/** Complete versioned HTTP boundary. The composition root owns mounting and dependencies. */
export const createExecutionApi = ({ service, auth, readiness }: ExecutionApiOptions) => {
  const app = new Hono<ExecutionAuthEnv>();
  // Build auth first so invalid credential slots fail startup even before preflight is served.
  const authentication = createExecutionAuthMiddleware(auth);
  app.use("/api/v2/*", createExecutionCorsMiddleware(auth));
  app.use("/api/v2/*", authentication);
  app.onError((_error, context) =>
    context.json(
      {
        error: executionError(
          "EXECUTION_INTERNAL_ERROR",
          "Execution request could not be completed.",
          "execution",
          true,
        ),
      },
      500,
    ),
  );

  const register = <S extends z.ZodType, O extends z.ZodType>(
    method: "GET" | "POST" | "PUT",
    path: string,
    scope: ExecutionScope,
    input: S,
    output: O,
    invoke: (
      principal: ExecutionPrincipal,
      input: z.output<S>,
    ) => ResultAsync<unknown, ExecutionError>,
    options: {
      appOnly?: boolean;
      maxBodyBytes?: number;
      status?: 200 | 201 | 202;
      respond?: (value: z.output<O>, context: Context<ExecutionAuthEnv>) => Response;
    } = {},
  ) =>
    app.on(method, `/api/v2${path}`, async (context) => {
      const principal = context.get("principal");
      if (
        !principal.scopes.includes(scope) ||
        (options.appOnly && context.get("credentialAudience") !== "app")
      )
        return context.json(
          {
            error: executionError(
              "EXECUTION_FORBIDDEN",
              "The authenticated credential cannot perform this action.",
              "authentication",
            ),
          },
          403,
        );
      const entries = [...new URL(context.req.url).searchParams.entries()];
      if (new Set(entries.map(([key]) => key)).size !== entries.length)
        return context.json(
          {
            error: executionError(
              "EXECUTION_QUERY_INVALID",
              "Duplicate query parameters are not accepted.",
            ),
          },
          400,
        );
      const rawBody =
        method === "GET"
          ? ok(undefined)
          : await readExecutionJson(context.req.raw, options.maxBodyBytes);
      if (rawBody.isErr())
        return context.json({ error: rawBody.error }, executionErrorStatus(rawBody.error));
      const parsed = input.safeParse({
        params: context.req.param(),
        query: Object.fromEntries(entries),
        body: rawBody.value,
      });
      if (!parsed.success)
        return context.json(
          {
            error: executionError(
              "EXECUTION_INPUT_INVALID",
              "Request parameters or JSON do not match the execution v2 contract.",
            ),
          },
          400,
        );
      const result = await invoke(principal, parsed.data);
      if (result.isErr()) {
        const error = publicExecutionError(result.error);

        return context.json({ error }, executionErrorStatus(error));
      }
      const validated = output.safeParse(result.value);
      if (!validated.success)
        return context.json(
          {
            error: executionError(
              "EXECUTION_RESPONSE_INVALID",
              "Execution service returned an invalid response.",
              "execution",
            ),
          },
          500,
        );
      if (options.respond) return options.respond(validated.data, context);

      return context.json(validated.data, options.status ?? 200);
    });

  app.get(
    "/api/v2/readiness",
    async (context, next) => {
      if (!context.get("principal").scopes.includes("execution:read"))
        return context.json(
          {
            error: executionError(
              "EXECUTION_FORBIDDEN",
              "The authenticated credential cannot read readiness.",
              "authentication",
            ),
          },
          403,
        );
      if ([...new URL(context.req.url).searchParams.keys()].length > 0)
        return context.json(
          {
            error: executionError(
              "EXECUTION_QUERY_INVALID",
              "Readiness does not accept query parameters.",
            ),
          },
          400,
        );
      await next();
    },
    createExecutionReadinessHandler(readiness),
  );
  register(
    "GET",
    "/operations",
    "definitions:read",
    envelope(z.undefined()),
    z.array(OperationRevisionSchema),
    (principal) => service.listOperations(principal),
  );
  register(
    "PUT",
    "/operations/:id",
    "definitions:write",
    identified(SaveOperationRevisionSchema).refine(
      (value) => value.params.id === value.body.operation.id,
    ),
    OperationRevisionSchema,
    (principal, input) => service.saveOperation(principal, input.body),
  );
  register(
    "GET",
    "/operations/:id/revisions/:revision",
    "definitions:read",
    z.strictObject({
      params: id.extend({ revision: integerQuery(1, Number.MAX_SAFE_INTEGER, "1") }),
      query: empty,
      body: z.undefined(),
    }),
    OperationRevisionSchema,
    (principal, input) =>
      service.getOperationRevision(principal, input.params.id, input.params.revision),
  );
  register(
    "GET",
    "/pipelines",
    "definitions:read",
    envelope(z.undefined()),
    z.array(PipelineDefinitionSchema),
    (principal) => service.listPipelines(principal),
  );
  register(
    "GET",
    "/pipelines/:id",
    "definitions:read",
    identified(z.undefined()),
    PipelineDefinitionSchema,
    (principal, input) => service.getPipeline(principal, input.params.id),
  );
  register(
    "PUT",
    "/pipelines/:id",
    "definitions:write",
    identified(SavePipelineDefinitionSchema).refine(
      (value) => value.params.id === value.body.pipelineId,
    ),
    PipelineDefinitionSchema,
    (principal, input) => service.savePipeline(principal, input.body),
  );
  register(
    "POST",
    "/run-requests",
    "execution:submit",
    envelope(RunRequestInputSchema),
    RunRequestReceiptSchema,
    (principal, input) => service.submit(principal, input.body),
    { status: 202 },
  );
  register(
    "GET",
    "/run-requests/:id",
    "execution:read",
    z.strictObject({
      params: z.strictObject({ id: ExecutionRequestIdSchema }),
      query: empty,
      body: z.undefined(),
    }),
    RunRequestReceiptSchema,
    (principal, input) => service.getRequest(principal, input.params.id),
  );
  register(
    "GET",
    "/job-summaries",
    "execution:read",
    envelope(z.undefined()),
    z.array(ExecutionJobSummarySchema),
    (principal) => service.listJobSummaries(principal),
  );
  register(
    "GET",
    "/job-summaries/:id",
    "execution:read",
    identified(z.undefined()),
    ExecutionJobSummarySchema,
    (principal, input) => service.getJobSummary(principal, input.params.id),
  );
  register(
    "GET",
    "/jobs",
    "execution:read",
    envelope(z.undefined()),
    z.array(ExecutionJobSchema),
    (principal) => service.listJobs(principal),
  );
  register(
    "GET",
    "/jobs/:id",
    "execution:read",
    identified(z.undefined()),
    ExecutionJobSchema,
    (principal, input) => service.getJob(principal, input.params.id),
  );
  register(
    "GET",
    "/jobs/:id/events",
    "execution:read",
    z.strictObject({
      params: id,
      query: z.strictObject({
        afterSequence: integerQuery(0, Number.MAX_SAFE_INTEGER, "0"),
        limit: integerQuery(1, 1000, "500"),
      }),
      body: z.undefined(),
    }),
    z.array(ExecutionEventSchema),
    (principal, input) =>
      service.getEvents(principal, input.params.id, input.query.afterSequence, input.query.limit),
  );
  register(
    "GET",
    "/jobs/:id/result",
    "execution:read",
    identified(z.undefined()),
    ExecutionJobResultSchema,
    (principal, input) => service.getResult(principal, input.params.id),
  );
  register(
    "GET",
    "/jobs/:id/artifacts",
    "artifacts:read",
    identified(z.undefined()),
    z.array(ExecutionArtifactSchema),
    (principal, input) => service.listArtifacts(principal, input.params.id),
  );
  register(
    "POST",
    "/jobs/:id/control",
    "execution:control",
    identified(ExecutionJobControlSchema),
    ExecutionJobSchema,
    (principal, input) => service.controlJob(principal, input.params.id, input.body),
  );
  register(
    "POST",
    "/jobs/:id/checkpoints/:nodeId/ack",
    "execution:control",
    z.strictObject({
      params: z.strictObject({ id: ExecutionIdentifierSchema, nodeId: ExecutionIdentifierSchema }),
      query: empty,
      body: empty,
    }),
    ExecutionJobSchema,
    (principal, input) => service.ackCheckpoint(principal, input.params.id, input.params.nodeId),
  );
  register(
    "GET",
    "/artifacts/:id",
    "artifacts:read",
    identified(z.undefined()),
    z.union([ExecutionArtifactSchema, ExecutionInputAssetSchema]),
    (principal, input) => service.getArtifact(principal, input.params.id),
  );
  register(
    "GET",
    "/artifacts/:id/content",
    "artifacts:read",
    z.strictObject({
      params: id,
      query: z.strictObject({
        offset: integerQuery(0, Number.MAX_SAFE_INTEGER, "0"),
        length: integerQuery(1, 1024 * 1024, "65536"),
      }),
      body: z.undefined(),
    }),
    ArtifactRangeSchema,
    (principal, input) => service.readArtifact(principal, input.params.id, input.query),
    {
      respond: (value, context) => {
        const query = new URL(context.req.url).searchParams;
        if (
          value.offset !== Number(query.get("offset") ?? 0) ||
          value.bytes.byteLength > Number(query.get("length") ?? 65_536) ||
          value.totalSizeBytes !== value.metadata.sizeBytes ||
          value.offset + value.bytes.byteLength > value.totalSizeBytes
        )
          return context.json(
            {
              error: executionError(
                "EXECUTION_RESPONSE_INVALID",
                "Execution service returned an invalid artifact range.",
                "artifact",
              ),
            },
            500,
          );
        context.header("Content-Type", "application/octet-stream");
        context.header(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(value.metadata.name)}`,
        );
        context.header("Content-Length", String(value.bytes.byteLength));
        context.header("X-Content-Type-Options", "nosniff");
        context.header("ETag", `"${value.metadata.sha256}"`);
        context.header("X-Ordine-Artifact-Sha256", value.metadata.sha256);
        if (value.bytes.byteLength > 0)
          context.header(
            "Content-Range",
            `bytes ${value.offset}-${value.offset + value.bytes.byteLength - 1}/${value.totalSizeBytes}`,
          );

        return context.body(new Uint8Array(value.bytes), value.bytes.byteLength > 0 ? 206 : 200);
      },
    },
  );
  register(
    "POST",
    "/input-assets",
    "artifacts:import",
    envelope(ImportInputSchema),
    ExecutionInputAssetSchema,
    (principal, input) => service.importInput(principal, input.body),
    { status: 201, maxBodyBytes: INPUT_ASSET_JSON_MAX_BYTES },
  );
  register(
    "GET",
    "/approvals/:id",
    "execution:read",
    identified(z.undefined()),
    ExecutionApprovalSchema,
    (principal, input) => service.getApproval(principal, input.params.id),
  );
  register(
    "POST",
    "/approvals/:id/approve",
    "execution:approve",
    identified(empty),
    RunRequestReceiptSchema,
    (principal, input) => service.approve(principal, input.params.id),
    { appOnly: true },
  );
  register(
    "POST",
    "/approvals/:id/reject",
    "execution:approve",
    identified(empty),
    RunRequestReceiptSchema,
    (principal, input) => service.reject(principal, input.params.id),
    { appOnly: true },
  );
  register(
    "GET",
    "/runtime-configs",
    "definitions:read",
    envelope(z.undefined()),
    z.array(ExecutionRuntimeConfigRecordSchema),
    (principal) => service.listRuntimeConfigs(principal),
  );
  register(
    "PUT",
    "/runtime-configs/:id",
    "definitions:write",
    identified(SaveExecutionRuntimeConfigSchema).refine(
      (value) => value.params.id === value.body.config.id,
    ),
    ExecutionRuntimeConfigRecordSchema,
    (principal, input) => service.saveRuntimeConfig(principal, input.body),
  );
  register(
    "GET",
    "/workspace-settings",
    "definitions:read",
    envelope(z.undefined()),
    ExecutionWorkspaceSettingsRecordSchema,
    (principal) => service.getWorkspaceSettings(principal),
  );
  register(
    "PUT",
    "/workspace-settings",
    "definitions:write",
    envelope(SaveExecutionWorkspaceSettingsSchema),
    ExecutionWorkspaceSettingsRecordSchema,
    (principal, input) => service.saveWorkspaceSettings(principal, input.body),
  );
  app.notFound(executionNotFound);

  return app;
};
