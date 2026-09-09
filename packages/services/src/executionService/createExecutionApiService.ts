import type { ExecutionJobRepository, ExecutionRepository } from "@repo/models";
import type { ExecutionJobRecord } from "@repo/db-schema";
import {
  ExecutionApprovalSchema,
  ExecutionEventSchema,
  ExecutionIdentifierSchema,
  ExecutionJobControlSchema,
  ExecutionJobResultSchema,
  ExecutionJobSchema,
  ExecutionJobSummarySchema,
  ExecutionRequestIdSchema,
  type ExecutionPrincipal,
  type ExecutionScope,
  ImportExecutionInputSchema,
  SaveExecutionRuntimeConfigSchema,
  SaveExecutionWorkspaceSettingsSchema,
  EXECUTION_MAX_INPUT_ASSET_BYTES,
} from "@repo/schemas";
import type { createExecutionArtifactStore } from "../executionArtifacts";
import type { ExecutionPreparationService } from "./createExecutionPreparationService";
import {
  executionFailure,
  executionServiceResult,
  requireExecutionScope,
  toExecutionServiceError,
} from "./serviceResult";

type ArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
const jobDto = (row: ExecutionJobRecord) =>
  ExecutionJobSchema.parse({
    apiVersion: 2,
    id: row.id,
    preparedRunId: row.preparedRunId,
    revision: row.revision,
    state: row.state,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    deadlineAt: row.deadlineAt?.toISOString() ?? null,
    waitingDeadlineAt: row.waitingDeadlineAt?.toISOString() ?? null,
    stopReason: row.stopReason,
    error: row.error,
    warnings: row.warnings,
  });

export const createExecutionApiService = (deps: {
  repository: ExecutionRepository;
  jobs: ExecutionJobRepository;
  artifactStore: ArtifactStore;
  preparation: ExecutionPreparationService;
}) => {
  const scoped = <T>(
    principal: ExecutionPrincipal,
    scope: ExecutionScope,
    action: (identity: ExecutionPrincipal) => Promise<T>,
  ) => executionServiceResult(async () => action(requireExecutionScope(principal, scope)));
  const requireJob = async (identity: ExecutionPrincipal, id: string) => {
    const row = await deps.repository.getJob(identity, ExecutionIdentifierSchema.parse(id));
    if (!row) executionFailure("NOT_FOUND", "Job was not found");

    return row;
  };

  return {
    ...deps.preparation,
    listOperations: (principal: ExecutionPrincipal) =>
      scoped(principal, "definitions:read", (identity) =>
        deps.repository.listOperations(identity.workspaceId),
      ),
    getOperationRevision: (principal: ExecutionPrincipal, id: string, revision: number) =>
      scoped(principal, "definitions:read", async (identity) => {
        if (!Number.isSafeInteger(revision) || revision < 1)
          executionFailure(
            "INVALID_INPUT",
            "Operation revision must be positive",
            "revision",
            "validation",
          );
        const operation = await deps.repository.getOperationRevision(
          identity.workspaceId,
          ExecutionIdentifierSchema.parse(id),
          revision,
        );
        if (!operation) executionFailure("NOT_FOUND", "Operation revision was not found");

        return operation;
      }),
    listPipelines: (principal: ExecutionPrincipal) =>
      scoped(principal, "definitions:read", (identity) =>
        deps.repository.listPipelines(identity.workspaceId),
      ),
    getPipeline: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "definitions:read", async (identity) => {
        const pipeline = await deps.repository.getPipeline(
          identity.workspaceId,
          ExecutionIdentifierSchema.parse(id),
        );
        if (!pipeline) executionFailure("NOT_FOUND", "Pipeline was not found");

        return pipeline;
      }),
    getRequest: (principal: ExecutionPrincipal, requestId: string) =>
      scoped(principal, "execution:read", async (identity) => {
        const receipt = await deps.repository.findRequest(
          identity,
          ExecutionRequestIdSchema.parse(requestId),
        );
        if (!receipt) executionFailure("NOT_FOUND", "RunRequest was not found");

        return receipt;
      }),
    listJobs: (principal: ExecutionPrincipal) =>
      scoped(principal, "execution:read", async (identity) => {
        const jobs = await deps.jobs.listJobs(identity);

        return jobs.map(jobDto);
      }),
    getJob: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:read", async (identity) =>
        jobDto(await requireJob(identity, id)),
      ),
    listJobSummaries: (principal: ExecutionPrincipal) =>
      scoped(principal, "execution:read", async (identity) => {
        const summaries = await deps.jobs.listJobSummaries(identity);

        return summaries.map(({ job, ...summary }) =>
          ExecutionJobSummarySchema.parse({ ...jobDto(job), ...summary }),
        );
      }),
    getJobSummary: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:read", async (identity) => {
        const { job, ...summary } = await deps.jobs.getJobSummary(
          identity,
          ExecutionIdentifierSchema.parse(id),
        );

        return ExecutionJobSummarySchema.parse({ ...jobDto(job), ...summary });
      }),
    getEvents: (principal: ExecutionPrincipal, id: string, afterSequence = 0, limit = 500) =>
      scoped(principal, "execution:read", async (identity) => {
        const events = await deps.jobs.getEvents(
          identity,
          ExecutionIdentifierSchema.parse(id),
          afterSequence,
          limit,
        );

        return events.map((event) =>
          ExecutionEventSchema.parse({
            sequence: event.id,
            jobId: event.jobId,
            nodeId: event.nodeId,
            attemptId: event.attemptId,
            type: event.type,
            payload: event.payload,
            createdAt: event.createdAt.toISOString(),
          }),
        );
      }),
    getResult: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:read", async (identity) => {
        const job = await requireJob(identity, id);
        const result = await deps.repository.getPipelineRun(identity, job.id);
        const artifacts = await deps.jobs.listArtifacts(identity, job.id);

        return ExecutionJobResultSchema.parse({
          jobId: job.id,
          state: job.state,
          outputs: result?.outputs ?? null,
          warnings: job.warnings,
          artifacts: artifacts.map((row) => row.metadata),
        });
      }),
    listArtifacts: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "artifacts:read", async (identity) => {
        const rows = await deps.jobs.listArtifacts(identity, ExecutionIdentifierSchema.parse(id));

        return rows.map((row) => row.metadata);
      }),
    getArtifact: (principal: ExecutionPrincipal, id: string) =>
      deps.artifactStore
        .readArtifact(principal, id, { length: 0 })
        .map(({ metadata }) => metadata)
        .mapErr(toExecutionServiceError),
    readArtifact: (
      principal: ExecutionPrincipal,
      id: string,
      range: { offset?: number; length?: number } = {},
    ) => deps.artifactStore.readArtifact(principal, id, range).mapErr(toExecutionServiceError),
    importInput: (principal: ExecutionPrincipal, value: unknown) =>
      scoped(principal, "artifacts:import", async (identity) => {
        const input = ImportExecutionInputSchema.parse(value);
        const bytes = Buffer.from(input.contentBase64, "base64");
        if (
          bytes.byteLength > EXECUTION_MAX_INPUT_ASSET_BYTES ||
          bytes.toString("base64") !== input.contentBase64
        )
          executionFailure(
            "INPUT_ASSET_TOO_LARGE",
            "Input must be canonical base64 and at most 8 MiB",
            "contentBase64",
            "artifact",
          );
        const created = await deps.artifactStore.importInput(identity, {
          importRequestId: input.importRequestId,
          name: input.name,
          mimeType: input.mimeType,
          bytes,
        });
        if (created.isErr()) throw created.error;

        return created.value;
      }),
    controlJob: (principal: ExecutionPrincipal, id: string, input: unknown) =>
      scoped(principal, "execution:control", async (identity) =>
        jobDto(
          await deps.jobs.requestControl(
            identity,
            ExecutionIdentifierSchema.parse(id),
            ExecutionJobControlSchema.parse(input).action,
          ),
        ),
      ),
    ackCheckpoint: (principal: ExecutionPrincipal, jobId: string, nodeId: string) =>
      scoped(principal, "execution:control", async (identity) =>
        jobDto(
          await deps.jobs.acknowledgeCheckpoint(
            identity,
            ExecutionIdentifierSchema.parse(jobId),
            ExecutionIdentifierSchema.parse(nodeId),
          ),
        ),
      ),
    approve: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:approve", (identity) =>
        deps.repository.approve(identity, ExecutionIdentifierSchema.parse(id)),
      ),
    reject: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:approve", (identity) =>
        deps.repository.reject(identity, ExecutionIdentifierSchema.parse(id)),
      ),
    getApproval: (principal: ExecutionPrincipal, id: string) =>
      scoped(principal, "execution:read", async (identity) => {
        const approval = await deps.repository.getApproval(
          identity,
          ExecutionIdentifierSchema.parse(id),
        );
        if (!approval) executionFailure("NOT_FOUND", "Approval was not found");

        return ExecutionApprovalSchema.parse(approval);
      }),
    listRuntimeConfigs: (principal: ExecutionPrincipal) =>
      scoped(principal, "definitions:read", async (identity) => {
        const rows = await deps.repository.listRuntimeConfigs(identity.workspaceId);

        return rows.map((row) => ({
          apiVersion: 2 as const,
          revision: row.revision,
          config: row.config,
        }));
      }),
    saveRuntimeConfig: (principal: ExecutionPrincipal, value: unknown) =>
      scoped(principal, "definitions:write", async (identity) => {
        const input = SaveExecutionRuntimeConfigSchema.parse(value);
        if (input.config.connection.mode !== "local")
          executionFailure(
            "RUNTIME_UNSUPPORTED",
            "This desktop release requires a local runtime",
            "config.connection",
          );
        const row = await deps.repository.saveRuntimeConfig(
          identity.workspaceId,
          input.config,
          input.expectedRevision,
        );

        return { apiVersion: 2 as const, revision: row.revision, config: row.config };
      }),
    getWorkspaceSettings: (principal: ExecutionPrincipal) =>
      scoped(principal, "definitions:read", async (identity) => {
        const row = await deps.repository.getWorkspaceSettings(identity.workspaceId);

        return {
          apiVersion: 2 as const,
          revision: row?.revision ?? 0,
          executionDefaults: row?.executionDefaults ?? {},
        };
      }),
    saveWorkspaceSettings: (principal: ExecutionPrincipal, value: unknown) =>
      scoped(principal, "definitions:write", async (identity) => {
        const input = SaveExecutionWorkspaceSettingsSchema.parse(value);
        const row = await deps.repository.saveWorkspaceSettings(
          identity.workspaceId,
          input.executionDefaults,
          input.expectedRevision,
        );

        return {
          apiVersion: 2 as const,
          revision: row.revision,
          executionDefaults: row.executionDefaults,
        };
      }),
  };
};
export type ExecutionApiService = ReturnType<typeof createExecutionApiService>;
