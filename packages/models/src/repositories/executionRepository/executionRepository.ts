import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { ExecutionRunRequestRecord, executionInputAssetsTable } from "@repo/db-schema";
import {
  AgentRuntimeConfigSchema,
  LocalConnectionSchema,
  SshConnectionSchema,
  ExecutionOverridesSchema,
  ExecutionIdentifierSchema,
  ExecutionInputAssetSchema,
  ExecutionArtifactSchema,
  ExecutionRequestIdSchema,
  ExecutionPrincipalSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  RunRequestInputSchema,
  RunRequestReceiptSchema,
  SavePipelineDefinitionSchema,
  type ExecutionPrincipal,
  type AgentRuntimeConfig,
  type ExecutionInputAsset,
  type ExecutionOverrides,
  type ExecutionScope,
  type OperationRevision,
  type PipelineDefinition,
  type PreparedRun,
  type RunRequestInput,
  type RunRequestReceipt,
  type SavePipelineDefinition,
} from "@repo/schemas";
import {
  createExecutionOperationHeadsDao,
  createExecutionOperationRevisionsDao,
  createExecutionPipelinesDao,
  createExecutionPreparedRunsDao,
  createExecutionRunRequestsDao,
  createExecutionApprovalsDao,
  createExecutionJobsDao,
  createExecutionPipelineRunsDao,
  createExecutionInputAssetsDao,
  createExecutionRuntimeConfigsDao,
  createExecutionWorkspaceSettingsDao,
  createExecutionArtifactsDao,
} from "../../daos/executionDaos";
import type { DbConnection, DbExecutor } from "../../types";
import {
  ExecutionApprovalExpiredError,
  ExecutionDecisionConflictError,
  ExecutionIdempotencyConflictError,
  ExecutionIntegrityError,
  ExecutionNotFoundError,
  ExecutionRevisionConflictError,
  ExecutionScopeError,
  ExecutionCapacityError,
} from "./executionErrors";
import { canonicalExecutionJson, hashExecutionJson, verifyPreparedRun } from "./executionHash";

type ExecutionIdentity = Pick<ExecutionPrincipal, "workspaceId" | "subjectId">;

const stableAssetFields = (value: ExecutionInputAsset) =>
  Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "artifactId" && key !== "createdAt"),
  );
const parseRuntimeConfig = (input: AgentRuntimeConfig): AgentRuntimeConfig => {
  const config = AgentRuntimeConfigSchema.strict().parse(input);
  const connection =
    input.connection.mode === "local"
      ? LocalConnectionSchema.strict().parse(input.connection)
      : SshConnectionSchema.strict().parse(input.connection);
  ExecutionIdentifierSchema.parse(config.id);

  return { ...config, connection };
};
const nextRevision = (expectedRevision: number): number => {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new ExecutionRevisionConflictError("configuration");

  return expectedRevision + 1;
};

const assertScope = (input: ExecutionPrincipal, scope: ExecutionScope): ExecutionPrincipal => {
  const principal = ExecutionPrincipalSchema.parse(input);
  if (!principal.scopes.includes(scope)) throw new ExecutionScopeError(scope);

  return principal;
};
const sameIdentity = (a: ExecutionIdentity, b: ExecutionIdentity) =>
  a.workspaceId === b.workspaceId && a.subjectId === b.subjectId;
const lockRequest = async (
  executor: DbExecutor,
  identity: ExecutionIdentity,
  requestId: string,
): Promise<void> => {
  const key = canonicalExecutionJson([
    "execution-request",
    identity.workspaceId,
    identity.subjectId,
    requestId,
  ]);
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
};
const databaseTime = async (executor: DbExecutor): Promise<Date> => {
  const rows = await executor.execute(sql`SELECT clock_timestamp() AS now`);
  const value = rows[0]?.["now"];
  const now = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(now.getTime()))
    throw new ExecutionIntegrityError("Database clock is unavailable");

  return now;
};

const operationAt = async (
  executor: DbExecutor,
  workspaceId: string,
  id: string,
  revision: number,
): Promise<OperationRevision | null> => {
  const row = await createExecutionOperationRevisionsDao(executor).findByRevision(
    workspaceId,
    id,
    revision,
  );
  if (!row) return null;
  const parsed = OperationRevisionSchema.safeParse(row.definition);
  if (
    !parsed.success ||
    parsed.data.id !== row.id ||
    parsed.data.revision !== row.revision ||
    hashExecutionJson(parsed.data) !== row.contentHash
  )
    throw new ExecutionIntegrityError("Stored Operation revision is inconsistent");
  if (row.revoked) throw new ExecutionIntegrityError("Pinned Operation revision has been revoked");

  return parsed.data;
};
const pipelineAt = async (
  executor: DbExecutor,
  workspaceId: string,
  id: string,
): Promise<PipelineDefinition | null> => {
  const row = await createExecutionPipelinesDao(executor).findById(workspaceId, id);
  if (!row) return null;
  const parsed = PipelineDefinitionSchema.safeParse(row.definition);
  if (!parsed.success || parsed.data.id !== row.id || parsed.data.revision !== row.revision)
    throw new ExecutionIntegrityError("Stored Pipeline definition is inconsistent");

  return parsed.data;
};
const preparedAt = async (
  executor: DbExecutor,
  identity: ExecutionIdentity,
  id: string,
): Promise<PreparedRun | null> => {
  const row = await createExecutionPreparedRunsDao(executor).findById(identity, id);
  if (!row) return null;
  const prepared = verifyPreparedRun(row.prepared);
  if (
    prepared.id !== row.id ||
    !sameIdentity(prepared, row) ||
    prepared.contentHash !== row.contentHash
  )
    throw new ExecutionIntegrityError("Stored PreparedRun identity or hash is inconsistent");

  return prepared;
};
const validatePinnedOperations = async (
  executor: DbExecutor,
  prepared: PreparedRun,
): Promise<void> => {
  for (const operation of prepared.operations) {
    const stored = await operationAt(
      executor,
      prepared.workspaceId,
      operation.id,
      operation.revision,
    );
    if (!stored || hashExecutionJson(stored) !== hashExecutionJson(operation))
      throw new ExecutionIntegrityError("Prepared Operation does not match its immutable revision");
  }
};
const validateInputArtifacts = async (
  executor: DbExecutor,
  prepared: PreparedRun,
): Promise<void> => {
  for (const snapshot of prepared.inputArtifacts) {
    if (snapshot.source.kind === "input_asset") {
      const row = await createExecutionInputAssetsDao(executor).findById(
        prepared,
        snapshot.artifactId,
      );
      if (!row) throw new ExecutionNotFoundError("Input asset");
      const metadata = ExecutionInputAssetSchema.parse(row.metadata);
      if (
        !sameIdentity(metadata, prepared) ||
        metadata.artifactId !== row.artifactId ||
        metadata.artifactId !== snapshot.artifactId ||
        metadata.name !== snapshot.name ||
        metadata.mimeType !== snapshot.mimeType ||
        metadata.sizeBytes !== snapshot.sizeBytes ||
        metadata.sha256 !== snapshot.sha256
      )
        throw new ExecutionIntegrityError(
          "Input asset snapshot fingerprint does not match stored metadata",
        );
    } else {
      const row = await createExecutionArtifactsDao(executor).findById(snapshot.artifactId);
      const job = await createExecutionJobsDao(executor).findById(prepared, snapshot.source.jobId);
      if (!row || !job) throw new ExecutionNotFoundError("Published input artifact");
      const metadata = ExecutionArtifactSchema.parse(row.metadata);
      if (
        row.state !== "published" ||
        metadata.state !== "published" ||
        job.state !== "succeeded" ||
        row.jobId !== job.id ||
        row.nodeId !== snapshot.source.nodeId ||
        row.portId !== snapshot.source.portId ||
        row.attemptId !== snapshot.source.attemptId ||
        metadata.artifactId !== row.artifactId ||
        metadata.jobId !== row.jobId ||
        metadata.nodeId !== row.nodeId ||
        metadata.portId !== row.portId ||
        metadata.attemptId !== row.attemptId ||
        metadata.name !== snapshot.name ||
        metadata.mimeType !== snapshot.mimeType ||
        metadata.sizeBytes !== snapshot.sizeBytes ||
        metadata.sha256 !== snapshot.sha256
      )
        throw new ExecutionIntegrityError(
          "Input artifact is unpublished or its provenance/fingerprint does not match",
        );
    }
  }
};

const receiptFor = async (
  executor: DbExecutor,
  request: ExecutionRunRequestRecord,
  persistExpiry = true,
): Promise<RunRequestReceipt> => {
  const receipt = RunRequestReceiptSchema.parse(request.receipt);
  if (
    request.inputHash !== hashExecutionJson(RunRequestInputSchema.parse(request.input)) ||
    request.input.requestId !== request.requestId ||
    receipt.requestId !== request.requestId ||
    receipt.state !== request.state ||
    !("preparedRunId" in receipt) ||
    receipt.preparedRunId !== request.preparedRunId
  )
    throw new ExecutionIntegrityError("Stored request receipt is inconsistent");
  const prepared = await preparedAt(executor, request, request.preparedRunId);
  if (!prepared) throw new ExecutionIntegrityError("Stored request has no PreparedRun");
  if (receipt.state === "awaiting_approval") {
    const approvals = createExecutionApprovalsDao(executor);
    const approval = await approvals.findById(receipt.approvalId);
    if (
      !approval ||
      approval.runRequestId !== request.id ||
      approval.state !== "pending" ||
      approval.preparedHash !== prepared.contentHash
    )
      throw new ExecutionIntegrityError("Pending request approval is inconsistent");
    const now = await databaseTime(executor);
    if (approval.expiresAt.getTime() <= now.getTime()) {
      if (persistExpiry && !(await approvals.decide(approval.id, "expired", now)))
        throw new ExecutionDecisionConflictError();
      const expired = RunRequestReceiptSchema.parse({
        apiVersion: 2,
        state: "expired",
        requestId: request.requestId,
        preparedRunId: prepared.id,
        expiredAt: approval.expiresAt.toISOString(),
      });
      if (
        persistExpiry &&
        !(await createExecutionRunRequestsDao(executor).updateReceipt(request.id, expired, now))
      )
        throw new ExecutionIntegrityError("Request disappeared during expiry");

      return expired;
    }
  }
  if (receipt.state === "accepted") {
    const job = await createExecutionJobsDao(executor).findById(request, receipt.jobId);
    const run = await createExecutionPipelineRunsDao(executor).findByJobId(receipt.jobId);
    if (!job || job.runRequestId !== request.id || !run || run.preparedRunId !== prepared.id)
      throw new ExecutionIntegrityError("Accepted request has incomplete Job records");
  }

  return receipt;
};
const accept = async (
  executor: DbExecutor,
  request: ExecutionRunRequestRecord,
  now: Date,
): Promise<RunRequestReceipt> => {
  const jobId = randomUUID();
  const prepared = await preparedAt(executor, request, request.preparedRunId);
  const timeouts = prepared && Object.values(prepared.resolvedNodes)[0]?.timeouts;
  if (!timeouts) throw new ExecutionIntegrityError("PreparedRun has no execution budgets");
  await createExecutionJobsDao(executor).create({
    id: jobId,
    runRequestId: request.id,
    preparedRunId: request.preparedRunId,
    workspaceId: request.workspaceId,
    subjectId: request.subjectId,
    state: "queued",
    createdAt: now,
    activeRemainingMs: timeouts.activeRunTimeoutMs,
    waitingRemainingMs: timeouts.waitingTimeoutMs,
  });
  await createExecutionPipelineRunsDao(executor).create({
    jobId,
    preparedRunId: request.preparedRunId,
  });
  const receipt = RunRequestReceiptSchema.parse({
    apiVersion: 2,
    state: "accepted",
    requestId: request.requestId,
    preparedRunId: request.preparedRunId,
    jobId,
    acceptedAt: now.toISOString(),
  });
  if (!(await createExecutionRunRequestsDao(executor).updateReceipt(request.id, receipt, now)))
    throw new ExecutionIntegrityError("RunRequest disappeared during acceptance");

  return receipt;
};
export const createExecutionRepository = (
  db: DbConnection,
  options: { maxPendingRequests?: number } = {},
) => {
  const maxPendingRequests = options.maxPendingRequests ?? 100;
  if (!Number.isSafeInteger(maxPendingRequests) || maxPendingRequests < 1)
    throw new ExecutionIntegrityError("Invalid pending request capacity");
  const decide = async (
    principalInput: ExecutionPrincipal,
    approvalId: string,
    decision: "approved" | "rejected",
  ): Promise<RunRequestReceipt> => {
    const principal = assertScope(principalInput, "execution:approve");
    const outcome = await db.transaction(async (tx) => {
      const approvals = createExecutionApprovalsDao(tx);
      const requests = createExecutionRunRequestsDao(tx);
      const initialApproval = await approvals.findById(approvalId);
      const initialRequest = initialApproval
        ? await requests.findById(initialApproval.runRequestId)
        : null;
      if (!initialApproval || !initialRequest || !sameIdentity(initialRequest, principal))
        throw new ExecutionNotFoundError("Approval");
      // Both decisions lock the same request identity before reading mutable decision state.
      await lockRequest(tx, principal, initialRequest.requestId);
      const approval = await approvals.findById(approvalId);
      const request = await requests.findById(initialRequest.id);
      if (!approval || !request) throw new ExecutionNotFoundError("Approval");
      const receipt = await receiptFor(tx, request);
      const prepared = await preparedAt(tx, principal, request.preparedRunId);
      if (!prepared || approval.preparedHash !== prepared.contentHash)
        throw new ExecutionIntegrityError("Approval snapshot hash does not match PreparedRun");
      if (decision === "approved" && approval.state === "approved" && receipt.state === "accepted")
        return receipt;
      if (decision === "rejected" && approval.state === "rejected" && receipt.state === "rejected")
        return receipt;
      if (receipt.state === "expired") return receipt;
      if (approval.state !== "pending" || request.state !== "awaiting_approval")
        throw new ExecutionDecisionConflictError();
      if (decision === "approved") {
        await validatePinnedOperations(tx, prepared);
        await validateInputArtifacts(tx, prepared);
      }
      const now = await databaseTime(tx);
      if (approval.expiresAt.getTime() <= now.getTime()) {
        if (!(await approvals.decide(approvalId, "expired", now)))
          throw new ExecutionDecisionConflictError();
        const expired = RunRequestReceiptSchema.parse({
          apiVersion: 2,
          state: "expired",
          requestId: request.requestId,
          preparedRunId: prepared.id,
          expiredAt: now.toISOString(),
        });
        if (!(await requests.updateReceipt(request.id, expired, now)))
          throw new ExecutionIntegrityError("RunRequest disappeared during expiry");

        return expired;
      }
      if (!(await approvals.decide(approvalId, decision, now)))
        throw new ExecutionDecisionConflictError();
      if (decision === "approved") return accept(tx, request, now);
      const rejected = RunRequestReceiptSchema.parse({
        apiVersion: 2,
        state: "rejected",
        requestId: request.requestId,
        preparedRunId: prepared.id,
        approvalId,
        decidedAt: now.toISOString(),
      });
      if (!(await requests.updateReceipt(request.id, rejected, now)))
        throw new ExecutionIntegrityError("RunRequest disappeared during rejection");

      return rejected;
    });
    // Expiry intentionally commits its durable decision; all partial acceptance failures reject inside the transaction.
    if (outcome.state === "expired") throw new ExecutionApprovalExpiredError();

    return outcome;
  };

  return {
    async getOperationRevision(workspaceId: string, id: string, revision: number) {
      return operationAt(db, workspaceId, id, revision);
    },
    async listOperations(workspaceId: string) {
      ExecutionIdentifierSchema.parse(workspaceId);
      const heads = await createExecutionOperationHeadsDao(db).list(workspaceId);
      const operations: OperationRevision[] = [];
      for (const head of heads) {
        const operation = await operationAt(db, workspaceId, head.id, head.latestRevision);
        if (!operation)
          throw new ExecutionIntegrityError("Operation head has no immutable revision");
        operations.push(operation);
      }

      return operations;
    },
    async listPipelines(workspaceId: string): Promise<PipelineDefinition[]> {
      ExecutionIdentifierSchema.parse(workspaceId);
      const rows = await createExecutionPipelinesDao(db).list(workspaceId);

      return rows.map((row) => PipelineDefinitionSchema.parse(row.definition));
    },
    async getPipeline(workspaceId: string, id: string) {
      return pipelineAt(db, workspaceId, id);
    },
    async savePipeline(
      workspaceId: string,
      input: SavePipelineDefinition,
    ): Promise<PipelineDefinition> {
      ExecutionIdentifierSchema.parse(workspaceId);
      const parsed = SavePipelineDefinitionSchema.parse(input);
      const definition = PipelineDefinitionSchema.parse({
        ...parsed.definition,
        apiVersion: 2,
        id: parsed.pipelineId,
        revision: parsed.expectedRevision + 1,
      });

      return db.transaction(async (tx) => {
        for (const node of definition.graph.nodes) {
          if (
            !(await operationAt(
              tx,
              workspaceId,
              node.operation.operationId,
              node.operation.revision,
            ))
          )
            throw new ExecutionNotFoundError("Operation revision");
        }
        const dao = createExecutionPipelinesDao(tx);
        const data = { workspaceId, id: definition.id, revision: definition.revision, definition };
        const row =
          parsed.expectedRevision === 0
            ? await dao.insertIfAbsent(data)
            : await dao.replace(data, parsed.expectedRevision);
        if (!row) throw new ExecutionRevisionConflictError("Pipeline");

        return row.definition;
      });
    },
    async saveOperation(
      workspaceId: string,
      input: OperationRevision,
      expectedRevision: number,
    ): Promise<OperationRevision> {
      ExecutionIdentifierSchema.parse(workspaceId);
      const definition = OperationRevisionSchema.parse(input);
      if (
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 0 ||
        definition.revision !== expectedRevision + 1
      )
        throw new ExecutionRevisionConflictError("Operation");

      return db.transaction(async (tx) => {
        const heads = createExecutionOperationHeadsDao(tx);
        const head =
          expectedRevision === 0
            ? await heads.insertIfAbsent({ workspaceId, id: definition.id, latestRevision: 1 })
            : await heads.advance(workspaceId, definition.id, expectedRevision);
        if (!head) throw new ExecutionRevisionConflictError("Operation");
        await createExecutionOperationRevisionsDao(tx).create({
          workspaceId,
          id: definition.id,
          revision: definition.revision,
          definition,
          contentHash: hashExecutionJson(definition),
        });

        return definition;
      });
    },
    async findRequest(
      identity: ExecutionIdentity,
      requestId: string,
    ): Promise<RunRequestReceipt | null> {
      return db.transaction(async (tx) => {
        await lockRequest(tx, identity, requestId);
        const request = await createExecutionRunRequestsDao(tx).findByRequestId(
          identity,
          requestId,
        );

        return request ? receiptFor(tx, request, false) : null;
      });
    },
    async replayRunRequest(
      principalInput: ExecutionPrincipal,
      inputValue: RunRequestInput,
      inputHash: string,
    ): Promise<RunRequestReceipt | null> {
      const principal = assertScope(principalInput, "execution:submit");
      const input = RunRequestInputSchema.parse(inputValue);
      if (hashExecutionJson(input) !== inputHash)
        throw new ExecutionIntegrityError("RunRequest input hash mismatch");

      return db.transaction(async (tx) => {
        await lockRequest(tx, principal, input.requestId);
        const request = await createExecutionRunRequestsDao(tx).findByRequestId(
          principal,
          input.requestId,
        );
        if (!request) return null;
        if (request.inputHash !== inputHash) throw new ExecutionIdempotencyConflictError();

        return receiptFor(tx, request);
      });
    },
    async expirePendingApprovals(workspaceId: string): Promise<RunRequestReceipt[]> {
      const rows = await db.execute(
        sql`SELECT r.subject_id, r.request_id FROM execution_run_requests r INNER JOIN execution_approvals a ON a.run_request_id=r.id WHERE r.workspace_id=${workspaceId} AND r.state='awaiting_approval' AND a.state='pending' AND a.expires_at <= clock_timestamp() ORDER BY r.id LIMIT 200`,
      );
      const receipts: RunRequestReceipt[] = [];
      for (const row of rows) {
        const identity = { workspaceId, subjectId: String(row["subject_id"]) };
        const requestId = String(row["request_id"]);
        const receipt = await db.transaction(async (tx) => {
          await lockRequest(tx, identity, requestId);
          const request = await createExecutionRunRequestsDao(tx).findByRequestId(
            identity,
            requestId,
          );

          return request?.state === "awaiting_approval" ? receiptFor(tx, request) : null;
        });
        if (receipt?.state === "expired") receipts.push(receipt);
      }

      return receipts;
    },
    async submitRun(
      principalInput: ExecutionPrincipal,
      inputValue: RunRequestInput,
      inputHash: string,
      preparedValue: PreparedRun,
      approvalTtlMs: number,
    ): Promise<RunRequestReceipt> {
      const principal = assertScope(principalInput, "execution:submit");
      const input = RunRequestInputSchema.parse(inputValue);
      if (hashExecutionJson(input) !== inputHash)
        throw new ExecutionIntegrityError("RunRequest input hash mismatch");
      if (!Number.isSafeInteger(approvalTtlMs) || approvalTtlMs < 1 || approvalTtlMs > 86_400_000)
        throw new ExecutionIntegrityError("Approval TTL must be between 1 ms and 24 hours");

      return db.transaction(async (tx) => {
        await lockRequest(tx, principal, input.requestId);
        const requests = createExecutionRunRequestsDao(tx);
        const existing = await requests.findByRequestId(principal, input.requestId);
        if (existing) {
          if (existing.inputHash !== inputHash) throw new ExecutionIdempotencyConflictError();

          return receiptFor(tx, existing);
        }
        const admissionKey = canonicalExecutionJson([
          "execution-admission",
          principal.workspaceId,
          principal.subjectId,
        ]);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${admissionKey}, 0))`);
        const counts = await tx.execute(sql`SELECT
          (SELECT count(*) FROM execution_run_requests r JOIN execution_approvals a ON a.run_request_id=r.id WHERE r.workspace_id=${principal.workspaceId} AND r.subject_id=${principal.subjectId} AND r.state='awaiting_approval' AND a.state='pending' AND a.expires_at>clock_timestamp())
          + (SELECT count(*) FROM execution_jobs j WHERE j.workspace_id=${principal.workspaceId} AND j.subject_id=${principal.subjectId} AND j.state IN ('queued','running','pausing','paused','waiting_for_input','cancelling')) AS pending`);
        if (Number(counts[0]?.["pending"]) >= maxPendingRequests)
          throw new ExecutionCapacityError();
        const prepared = verifyPreparedRun(preparedValue);
        if (
          !sameIdentity(principal, prepared) ||
          prepared.pipeline.id !== input.pipelineId ||
          prepared.pipeline.revision !== input.expectedRevision ||
          hashExecutionJson(prepared.inputs) !== hashExecutionJson(input.inputs) ||
          hashExecutionJson(prepared.deliveryRequirements) !==
            hashExecutionJson(input.deliveryRequirements)
        )
          throw new ExecutionIntegrityError("PreparedRun does not match request identity or input");
        const currentPipeline = await pipelineAt(tx, principal.workspaceId, input.pipelineId);
        if (!currentPipeline || currentPipeline.revision !== input.expectedRevision)
          throw new ExecutionRevisionConflictError("Pipeline");
        if (hashExecutionJson(currentPipeline) !== hashExecutionJson(prepared.pipeline))
          throw new ExecutionIntegrityError("Prepared Pipeline differs from saved revision");
        await validatePinnedOperations(tx, prepared);
        await validateInputArtifacts(tx, prepared);
        const now = await databaseTime(tx);
        await createExecutionPreparedRunsDao(tx).create({
          id: prepared.id,
          workspaceId: principal.workspaceId,
          subjectId: principal.subjectId,
          prepared,
          contentHash: prepared.contentHash,
        });
        const approvalId = randomUUID();
        const pending = RunRequestReceiptSchema.parse({
          apiVersion: 2,
          state: "awaiting_approval",
          requestId: input.requestId,
          preparedRunId: prepared.id,
          approvalId,
          expiresAt: new Date(now.getTime() + approvalTtlMs).toISOString(),
        });
        const request = await requests.create({
          id: randomUUID(),
          workspaceId: principal.workspaceId,
          subjectId: principal.subjectId,
          requestId: input.requestId,
          inputHash,
          input,
          preparedRunId: prepared.id,
          state: "awaiting_approval",
          receipt: pending,
          createdAt: now,
          updatedAt: now,
        });
        if (!prepared.risk.requiresApproval) return accept(tx, request, now);
        await createExecutionApprovalsDao(tx).create({
          id: approvalId,
          runRequestId: request.id,
          preparedHash: prepared.contentHash,
          state: "pending",
          expiresAt: new Date(now.getTime() + approvalTtlMs),
        });

        return pending;
      });
    },
    async approve(principal: ExecutionPrincipal, approvalId: string) {
      return decide(principal, approvalId, "approved");
    },
    async getApproval(identity: ExecutionIdentity, approvalId: string) {
      return db.transaction(async (tx) => {
        const approval = await createExecutionApprovalsDao(tx).findById(approvalId);
        if (!approval) return null;
        const request = await createExecutionRunRequestsDao(tx).findById(approval.runRequestId);
        if (!request || !sameIdentity(identity, request)) return null;
        const prepared = await preparedAt(tx, identity, request.preparedRunId);
        if (!prepared || prepared.contentHash !== approval.preparedHash)
          throw new ExecutionIntegrityError("Approval snapshot is inconsistent");
        const now = await databaseTime(tx);

        return {
          id: approval.id,
          requestId: request.requestId,
          expiresAt: approval.expiresAt.toISOString(),
          state:
            approval.state === "pending" && approval.expiresAt.getTime() <= now.getTime()
              ? ("expired" as const)
              : approval.state,
          prepared,
        };
      });
    },
    async reject(principal: ExecutionPrincipal, approvalId: string) {
      return decide(principal, approvalId, "rejected");
    },
    async getPrepared(identity: ExecutionIdentity, id: string) {
      return preparedAt(db, identity, id);
    },
    async getJob(identity: ExecutionIdentity, id: string) {
      return createExecutionJobsDao(db).findById(identity, id);
    },
    async getPipelineRun(identity: ExecutionIdentity, jobId: string) {
      const job = await createExecutionJobsDao(db).findById(identity, jobId);

      return job ? createExecutionPipelineRunsDao(db).findByJobId(jobId) : null;
    },
    async getInputAsset(identity: ExecutionIdentity, artifactId: string) {
      const row = await createExecutionInputAssetsDao(db).findById(identity, artifactId);
      if (!row) return null;
      const metadata = ExecutionInputAssetSchema.parse(row.metadata);
      if (!sameIdentity(row, metadata) || row.artifactId !== metadata.artifactId)
        throw new ExecutionIntegrityError("Stored input asset identity is inconsistent");

      return { ...row, metadata };
    },
    async replayInputImport(
      principalInput: ExecutionPrincipal,
      importRequestId: string,
      inputHash: string,
    ) {
      const principal = assertScope(principalInput, "artifacts:import");
      ExecutionRequestIdSchema.parse(importRequestId);
      if (!/^[a-f0-9]{64}$/u.test(inputHash))
        throw new ExecutionIntegrityError("Invalid input import hash");
      const row = await createExecutionInputAssetsDao(db).findByImport(principal, importRequestId);
      if (!row) return null;
      if (row.inputHash !== inputHash) throw new ExecutionIdempotencyConflictError();
      const metadata = ExecutionInputAssetSchema.parse(row.metadata);
      if (!sameIdentity(row, metadata) || metadata.artifactId !== row.artifactId)
        throw new ExecutionIntegrityError("Stored input import identity is inconsistent");

      return { ...row, metadata };
    },
    async createInputAsset(
      principalInput: ExecutionPrincipal,
      data: Omit<typeof executionInputAssetsTable.$inferInsert, "workspaceId" | "subjectId">,
    ) {
      const principal = assertScope(principalInput, "artifacts:import");
      const metadata = ExecutionInputAssetSchema.parse(data.metadata);
      ExecutionRequestIdSchema.parse(data.importRequestId);
      if (
        !sameIdentity(principal, metadata) ||
        data.artifactId !== metadata.artifactId ||
        !data.storageKey ||
        data.storageKey.length > 1024 ||
        !/^[a-f0-9]{64}$/u.test(data.inputHash)
      )
        throw new ExecutionIntegrityError(
          "Input asset metadata does not match its import identity",
        );

      return db.transaction(async (tx) => {
        const key = canonicalExecutionJson([
          "execution-input-import",
          principal.workspaceId,
          principal.subjectId,
          data.importRequestId,
        ]);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        const dao = createExecutionInputAssetsDao(tx);
        const existing = await dao.findByImport(principal, data.importRequestId);
        if (existing) {
          if (existing.inputHash !== data.inputHash) throw new ExecutionIdempotencyConflictError();
          const persisted = ExecutionInputAssetSchema.parse(existing.metadata);
          if (
            !sameIdentity(persisted, principal) ||
            persisted.artifactId !== existing.artifactId ||
            hashExecutionJson(stableAssetFields(persisted)) !==
              hashExecutionJson(stableAssetFields(metadata))
          )
            throw new ExecutionIntegrityError("Matching input import hash has different metadata");

          return existing;
        }

        return dao.create({
          ...data,
          metadata,
          workspaceId: principal.workspaceId,
          subjectId: principal.subjectId,
        });
      });
    },
    async getRuntimeConfig(workspaceId: string, id: string) {
      const row = await createExecutionRuntimeConfigsDao(db).findById(workspaceId, id);
      if (!row) return null;
      const config = parseRuntimeConfig(row.config);
      if (config.id !== row.id)
        throw new ExecutionIntegrityError("Runtime config identity is inconsistent");

      return { ...row, config };
    },
    async listRuntimeConfigs(workspaceId: string) {
      const rows = await createExecutionRuntimeConfigsDao(db).list(workspaceId);

      return rows.map((row) => {
        const config = parseRuntimeConfig(row.config);
        if (config.id !== row.id)
          throw new ExecutionIntegrityError("Runtime config identity is inconsistent");

        return { ...row, config };
      });
    },
    async saveRuntimeConfig(
      workspaceId: string,
      input: AgentRuntimeConfig,
      expectedRevision: number,
    ) {
      ExecutionIdentifierSchema.parse(workspaceId);
      const config = parseRuntimeConfig(input);
      const row = await createExecutionRuntimeConfigsDao(db).save(
        { workspaceId, id: config.id, config, revision: nextRevision(expectedRevision) },
        expectedRevision,
      );
      if (!row) throw new ExecutionRevisionConflictError("runtime config");

      return row;
    },
    async getWorkspaceSettings(workspaceId: string) {
      const row = await createExecutionWorkspaceSettingsDao(db).findByWorkspaceId(workspaceId);

      return row
        ? { ...row, executionDefaults: ExecutionOverridesSchema.parse(row.executionDefaults) }
        : null;
    },
    async listWorkspaceSettings(workspaceId: string) {
      const row = await createExecutionWorkspaceSettingsDao(db).findByWorkspaceId(workspaceId);

      return row
        ? [{ ...row, executionDefaults: ExecutionOverridesSchema.parse(row.executionDefaults) }]
        : [];
    },
    async saveWorkspaceSettings(
      workspaceId: string,
      input: ExecutionOverrides,
      expectedRevision: number,
    ) {
      ExecutionIdentifierSchema.parse(workspaceId);
      const executionDefaults = ExecutionOverridesSchema.parse(input);
      const row = await createExecutionWorkspaceSettingsDao(db).save(
        { workspaceId, executionDefaults, revision: nextRevision(expectedRevision) },
        expectedRevision,
      );
      if (!row) throw new ExecutionRevisionConflictError("workspace settings");

      return row;
    },
  };
};
export type ExecutionRepository = ReturnType<typeof createExecutionRepository>;
