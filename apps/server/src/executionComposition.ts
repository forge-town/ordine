import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import type { ExecutionDatabase } from "@repo/db/execution";
import { createExecutionRepository, createExecutionJobRepository } from "@repo/models";
import {
  createExecutionArtifactStore,
  createExecutionPreparationService,
  createExecutionApiService,
  createExecutionJobRunner,
  createExecutionDispatcher,
  createExecutionPromptActor,
  executionServiceResult,
} from "@repo/services/execution";
import {
  ExecutionJsonObjectSchema,
  ExecutionPrincipalSchema,
  ExecutionScopeSchema,
} from "@repo/schemas";
import { createExecutionApi } from "./execution/createExecutionApi";
import type { ExecutionAuthOptions } from "./execution/auth";
import { readExecutionJson } from "./execution/body";
import { executionNotFound } from "./execution/versionBoundary";

export const createExecutionApplication = (options: {
  database: ExecutionDatabase;
  artifactDirectory: string;
  workspaceId: string;
  subjectId: string;
  instanceId: string;
  buildRevision: string;
  auth: ExecutionAuthOptions;
  scriptExecutables: Partial<Record<"javascript" | "python" | "bash", string>>;
  onShutdown?: () => void;
}) =>
  executionServiceResult(async () => {
    const requests = createExecutionRepository(options.database.connection);
    const jobs = createExecutionJobRepository(options.database.connection);
    const initialized = await createExecutionArtifactStore({
      rootDirectory: options.artifactDirectory,
      persistence: {
        replayInputImport: requests.replayInputImport,
        createInputAsset: requests.createInputAsset,
        getInputAsset: requests.getInputAsset,
        getProducedArtifact: jobs.getProducedArtifact,
        registerArtifact: jobs.registerArtifact,
        assertLease: jobs.assertArtifactLease,
        assertJobLease: jobs.assertJobLease,
      },
    });
    if (initialized.isErr()) throw initialized.error;
    const artifacts = initialized.value;
    const principal = ExecutionPrincipalSchema.parse({
      subjectId: options.subjectId,
      workspaceId: options.workspaceId,
      scopes: ExecutionScopeSchema.options,
    });
    const prompt = createExecutionPromptActor({
      artifactStore: artifacts,
      onRuntimeEvent: async (context, event) =>
        executionServiceResult(async () => {
          await jobs.appendEvent(context.artifactContext.lease, {
            type: "runtime_event",
            nodeId: context.node.id,
            attemptId: context.attemptId,
            payload: ExecutionJsonObjectSchema.parse(JSON.parse(JSON.stringify(event))),
          });
        }),
    });
    const runner = createExecutionJobRunner({
      requests,
      jobs,
      artifactStore: artifacts,
      executePrompt: prompt.execute,
    });
    const dispatcher = createExecutionDispatcher({
      principal,
      instanceId: options.instanceId,
      requests,
      jobs,
      runner,
    });
    const preparation = createExecutionPreparationService({
      repository: requests,
      artifactStore: artifacts,
      scriptExecutables: options.scriptExecutables,
      isAccepting: dispatcher.isAccepting,
    });
    const service = createExecutionApiService({
      repository: requests,
      jobs,
      artifactStore: artifacts,
      preparation,
    });
    const api = createExecutionApi({
      service,
      auth: options.auth,
      readiness: {
        buildRevision: options.buildRevision,
        instanceId: options.instanceId,
        workspaceId: options.workspaceId,
        mode: options.auth.mode,
        limits: {
          maxNodes: 200,
          maxEdges: 500,
          maxRequestBytes: 2 * 1024 * 1024,
          maxInlineValueBytes: 256 * 1024,
        },
        probeDatabase: async () => options.database.probe(),
        listLocalRuntimeIds: async () => {
          const runtimes = await requests.listRuntimeConfigs(options.workspaceId);

          return runtimes
            .filter(
              (row) =>
                row.config.type === "codex" &&
                row.config.connection.mode === "local" &&
                row.config.connection.path,
            )
            .map((row) => row.id);
        },
      },
    });
    const lifecycle = { draining: false, requests: 0 };
    const closeAdmission = () => {
      lifecycle.draining = true;
      dispatcher.closeAdmission();
    };
    if (options.onShutdown)
      api.post("/api/v2/shutdown", async (context) => {
        if (
          context.get("credentialAudience") !== "app" ||
          !context.get("principal").scopes.includes("execution:control")
        )
          return context.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Only the owning application can shut down execution",
                retryable: false,
                stage: "authentication",
              },
            },
            403,
          );
        const input = await readExecutionJson(context.req.raw);
        if (input.isErr() || !z.strictObject({}).safeParse(input.value).success)
          return context.json(
            {
              error: {
                code: "INVALID_INPUT",
                message: "Shutdown requires an empty JSON object",
                retryable: false,
                stage: "validation",
              },
            },
            400,
          );
        closeAdmission();
        setTimeout(() => options.onShutdown!(), 0);

        return context.json({ state: "stopping" }, 202);
      });
    const app = new Hono();
    app.use("*", async (context, next) => {
      if (
        lifecycle.draining &&
        ["POST", "PUT"].includes(context.req.method) &&
        context.req.path !== "/api/v2/shutdown"
      )
        return context.json(
          {
            error: {
              code: "EXECUTION_DRAINING",
              message: "This application is shutting down",
              retryable: true,
              stage: "execution",
            },
          },
          503,
        );
      lifecycle.requests += 1;
      const result = await ResultAsync.fromPromise(next(), (error) => error);
      lifecycle.requests -= 1;
      if (result.isErr()) throw result.error;
    });
    app.onError((_error, context) =>
      context.json(
        {
          error: {
            code: "EXECUTION_INTERNAL_ERROR",
            message: "Execution request could not be completed",
            retryable: false,
            stage: "execution",
          },
        },
        500,
      ),
    );
    app.route("/", api);
    app.notFound(executionNotFound);

    const drainRequests = async () => {
      const deadline = Date.now() + 25_000;
      while (lifecycle.requests > 0) {
        if (Date.now() > deadline) throw new Error("Execution requests did not drain");
        await new Promise<void>((resolve) => setTimeout(resolve, 20));
      }
    };

    return {
      app,
      api,
      service,
      artifacts,
      requests,
      jobs,
      runner,
      dispatcher,
      database: options.database,
      closeAdmission,
      drainRequests,
    };
  });
export type ExecutionApplication = ReturnType<
  Awaited<ReturnType<typeof createExecutionApplication>>["_unsafeUnwrap"]
>;
