import { randomUUID } from "node:crypto";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import type { ExecutionArtifactRecord, ExecutionInputAssetRecord } from "@repo/db-schema";
import {
  ExecutionArtifactSchema,
  ExecutionIdentifierSchema,
  ExecutionInputAssetSchema,
  ExecutionInputArtifactSnapshotSchema,
  ExecutionPortIdSchema,
  ExecutionPrincipalSchema,
  ExecutionRequestIdSchema,
  type ExecutionArtifact,
  type ExecutionInputAsset,
  type ExecutionPrincipal,
} from "@repo/schemas";
import { artifactHash, normalizeArtifactDescription, validateArtifactContent } from "./content";
import { ArtifactStoreError, assertArtifactNotAborted, toArtifactStoreError } from "./errors";
import {
  initializeArtifactFileSystem,
  validateArtifactStorageKey,
  validateAttemptRelativePath,
} from "./fileSystem";
import type {
  ExecutionArtifactContext,
  ExecutionArtifactJobContext,
  ExecutionArtifactFingerprint,
  ExecutionArtifactPersistence,
  ExecutionArtifactRead,
  ExecutionProducedArtifactContext,
} from "./types";

const LimitsSchema = z.object({
  maxFileBytes: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .default(50 * 1024 * 1024),
  maxConcurrentReads: z.number().int().min(1).max(64).default(4),
});
const JobContextSchema = z.object({
  lease: ExecutionPrincipalSchema.pick({ workspaceId: true, subjectId: true }).extend({
    jobId: z.uuid(),
    executorId: ExecutionIdentifierSchema,
    generation: z.number().int().positive(),
  }),
  signal: z.custom<AbortSignal>((value) => value instanceof AbortSignal),
});
const ContextSchema = JobContextSchema.extend({
  nodeId: ExecutionIdentifierSchema,
  attemptId: z.uuid(),
});
type ArtifactStoreOptions = {
  rootDirectory: string;
  persistence: ExecutionArtifactPersistence;
  limits?: z.input<typeof LimitsSchema>;
};
type Payload = Pick<ExecutionArtifact, "name" | "mimeType"> & { bytes: Uint8Array };
type StoredArtifact =
  | { kind: "input_asset"; metadata: ExecutionInputAsset; storageKey: string }
  | { kind: "job_artifact"; metadata: ExecutionArtifact; storageKey: string };

const resultOf = <T>(operation: () => Promise<T>) =>
  ResultAsync.fromPromise(Promise.resolve().then(operation), toArtifactStoreError);
const persistenceResult = async <T>(operation: () => Promise<T>): Promise<T> => {
  const result = await ResultAsync.fromPromise(Promise.resolve().then(operation), (error) =>
    error instanceof Error && error.name === "ExecutionIdempotencyConflictError"
      ? toArtifactStoreError(error)
      : new ArtifactStoreError(
          "ARTIFACT_PERSISTENCE_FAILED",
          "Artifact metadata persistence failed.",
        ),
  );
  if (result.isErr()) throw result.error;

  return result.value;
};
const principalWithScope = (
  principal: ExecutionPrincipal,
  scope: "artifacts:read" | "artifacts:import",
) => {
  const parsed = ExecutionPrincipalSchema.safeParse(principal);
  if (!parsed.success || !parsed.data.scopes.includes(scope))
    throw new ArtifactStoreError("ARTIFACT_FORBIDDEN", "Artifact permission is required.");

  return parsed.data;
};
const validateContext = (context: ExecutionArtifactContext) => {
  if (!ContextSchema.safeParse(context).success)
    throw new ArtifactStoreError(
      "ARTIFACT_CONTEXT_INVALID",
      "Artifact execution context is invalid.",
    );
  assertArtifactNotAborted(context.signal);
};
const fingerprint = (
  metadata: ExecutionArtifact | ExecutionInputAsset,
): ExecutionArtifactFingerprint => ({
  artifactId: metadata.artifactId,
  mimeType: metadata.mimeType,
  sizeBytes: metadata.sizeBytes,
  sha256: metadata.sha256,
});
const inputFieldsHash = (metadata: Omit<ExecutionInputAsset, "artifactId" | "createdAt">): string =>
  artifactHash(
    new TextEncoder().encode(
      JSON.stringify({
        mimeType: metadata.mimeType,
        name: metadata.name,
        sha256: metadata.sha256,
        sizeBytes: metadata.sizeBytes,
        subjectId: metadata.subjectId,
        workspaceId: metadata.workspaceId,
      }),
    ),
  );

const inputRow = (
  identity: Pick<ExecutionPrincipal, "subjectId" | "workspaceId">,
  row: ExecutionInputAssetRecord,
): Extract<StoredArtifact, { kind: "input_asset" }> => {
  const parsed = ExecutionInputAssetSchema.safeParse(row.metadata);
  if (
    !parsed.success ||
    parsed.data.artifactId !== row.artifactId ||
    parsed.data.subjectId !== row.subjectId ||
    parsed.data.workspaceId !== row.workspaceId ||
    row.subjectId !== identity.subjectId ||
    row.workspaceId !== identity.workspaceId
  )
    throw new ArtifactStoreError(
      "ARTIFACT_METADATA_INVALID",
      "Input asset identity is inconsistent.",
    );
  validateArtifactStorageKey(row.storageKey);
  if (row.storageKey !== `inputs/${row.artifactId}`)
    throw new ArtifactStoreError(
      "ARTIFACT_METADATA_INVALID",
      "Input asset storage ownership is inconsistent.",
    );

  return { kind: "input_asset", metadata: parsed.data, storageKey: row.storageKey };
};
const producedRow = (
  row: ExecutionArtifactRecord,
  context?: Pick<ExecutionArtifactJobContext, "lease">,
): Extract<StoredArtifact, { kind: "job_artifact" }> => {
  const parsed = ExecutionArtifactSchema.safeParse(row.metadata);
  if (
    !parsed.success ||
    (["artifactId", "jobId", "nodeId", "portId", "attemptId", "state"] as const).some(
      (key) => parsed.data[key] !== row[key],
    )
  )
    throw new ArtifactStoreError(
      "ARTIFACT_METADATA_INVALID",
      "Produced artifact metadata is inconsistent.",
    );
  const metadata = parsed.data;
  if (
    metadata.state !== "published" &&
    !(context && metadata.state === "validated" && metadata.jobId === context.lease.jobId)
  )
    throw new ArtifactStoreError(
      "ARTIFACT_NOT_AVAILABLE",
      "Artifact is not available for this reader.",
    );
  validateArtifactStorageKey(row.storageKey);
  if (row.storageKey !== `jobs/${metadata.jobId}/${metadata.attemptId}/${metadata.artifactId}`)
    throw new ArtifactStoreError(
      "ARTIFACT_METADATA_INVALID",
      "Produced artifact storage ownership is inconsistent.",
    );

  return { kind: "job_artifact", metadata, storageKey: row.storageKey };
};
/** No database or repository is imported at runtime; persistence owns identity and transaction fencing. */
export const createExecutionArtifactStore = (options: ArtifactStoreOptions) =>
  resultOf(async () => {
    const parsedLimits = LimitsSchema.safeParse(options.limits ?? {});
    if (!parsedLimits.success)
      throw new ArtifactStoreError("ARTIFACT_LIMITS_INVALID", "Artifact limits are invalid.");
    const limits = parsedLimits.data;
    const persistence = options.persistence;
    const files = await initializeArtifactFileSystem(options.rootDirectory, limits.maxFileBytes);
    const readState = { active: 0 };
    const limitedRead = async <T>(operation: () => Promise<T>): Promise<T> => {
      if (readState.active >= limits.maxConcurrentReads)
        throw new ArtifactStoreError("ARTIFACT_READ_LIMIT", "Artifact read capacity is exhausted.");
      readState.active += 1;
      const result = await resultOf(operation);
      readState.active -= 1;
      if (result.isErr()) throw result.error;

      return result.value;
    };
    const assertLease = async (context: ExecutionArtifactContext) => {
      validateContext(context);
      const checked = await ResultAsync.fromPromise(
        Promise.resolve().then(() => persistence.assertLease(context)),
        () =>
          new ArtifactStoreError(
            "ARTIFACT_LEASE_LOST",
            "Artifact execution authority is no longer valid.",
          ),
      );
      if (checked.isErr()) throw checked.error;
      assertArtifactNotAborted(context.signal);
    };
    const assertJobLease = async (context: ExecutionArtifactJobContext) => {
      if (!JobContextSchema.safeParse(context).success)
        throw new ArtifactStoreError(
          "ARTIFACT_CONTEXT_INVALID",
          "Artifact Job context is invalid.",
        );
      assertArtifactNotAborted(context.signal);
      const checked = await ResultAsync.fromPromise(
        Promise.resolve().then(() => persistence.assertJobLease(context.lease)),
        () =>
          new ArtifactStoreError(
            "ARTIFACT_LEASE_LOST",
            "Artifact Job authority is no longer valid.",
          ),
      );
      if (checked.isErr()) throw checked.error;
      assertArtifactNotAborted(context.signal);
    };
    const normalizedPayload = (payload: Payload) => {
      const description = normalizeArtifactDescription(payload.name, payload.mimeType);
      if (!(payload.bytes instanceof Uint8Array) || payload.bytes.byteLength > limits.maxFileBytes)
        throw new ArtifactStoreError(
          "ARTIFACT_SIZE_LIMIT",
          "Artifact exceeds the configured file limit.",
        );
      const bytes = new Uint8Array(payload.bytes);
      validateArtifactContent(bytes, description.mimeType);

      return { ...description, bytes, sizeBytes: bytes.byteLength, sha256: artifactHash(bytes) };
    };
    const resolveStored = async (
      identity: Pick<ExecutionPrincipal, "subjectId" | "workspaceId">,
      artifactId: string,
      context?: Pick<ExecutionArtifactJobContext, "lease">,
    ): Promise<StoredArtifact> => {
      if (!ExecutionIdentifierSchema.safeParse(artifactId).success)
        throw new ArtifactStoreError("ARTIFACT_ID_INVALID", "Artifact identifier is invalid.");
      const input = await persistenceResult(() => persistence.getInputAsset(identity, artifactId));
      if (input) {
        if (input.artifactId !== artifactId)
          throw new ArtifactStoreError(
            "ARTIFACT_METADATA_INVALID",
            "Artifact lookup returned a different identifier.",
          );

        return inputRow(identity, input);
      }
      const output = await persistenceResult(() =>
        persistence.getProducedArtifact(
          identity,
          artifactId,
          context ? { lease: context.lease } : {},
        ),
      );
      if (!output) throw new ArtifactStoreError("ARTIFACT_NOT_FOUND", "Artifact was not found.");
      if (output.artifactId !== artifactId)
        throw new ArtifactStoreError(
          "ARTIFACT_METADATA_INVALID",
          "Artifact lookup returned a different identifier.",
        );

      return producedRow(output, context);
    };
    const verifiedRead = (stored: StoredArtifact, signal?: AbortSignal) =>
      limitedRead(async () => {
        if (stored.metadata.sizeBytes > limits.maxFileBytes)
          throw new ArtifactStoreError(
            "ARTIFACT_SIZE_LIMIT",
            "Artifact exceeds the configured file limit.",
          );
        const bytes = await files.readVerifiedFile(stored.storageKey, signal);
        if (
          bytes.byteLength !== stored.metadata.sizeBytes ||
          artifactHash(bytes) !== stored.metadata.sha256
        )
          throw new ArtifactStoreError(
            "ARTIFACT_INTEGRITY_FAILED",
            "Artifact size or fingerprint no longer matches its metadata.",
          );
        const description = normalizeArtifactDescription(
          stored.metadata.name,
          stored.metadata.mimeType,
        );
        if (description.mimeType !== stored.metadata.mimeType)
          throw new ArtifactStoreError(
            "ARTIFACT_METADATA_INVALID",
            "Artifact MIME metadata is not canonical.",
          );
        validateArtifactContent(bytes, description.mimeType);

        return bytes;
      });
    const outcome = async (artifactId: string, status: "registered" | "orphaned") => {
      // Outcome hints aid orphan recovery; the registry is authoritative if this advisory write fails.
      await resultOf(() => files.markOutcome(artifactId, status));
    };
    const stageAndRegister = async <T>(
      artifactId: string,
      operation: () => Promise<T>,
    ): Promise<T> => {
      const result = await resultOf(operation);
      if (result.isErr())
        throw new ArtifactStoreError(result.error.code, result.error.message, artifactId);

      return result.value;
    };
    const readArtifact = (
      principalInput: ExecutionPrincipal,
      artifactId: string,
      range: { offset?: number; length?: number } = {},
    ) =>
      resultOf(async (): Promise<ExecutionArtifactRead> => {
        const principal = principalWithScope(principalInput, "artifacts:read");
        const parsed = z
          .object({
            offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
            length: z.number().int().nonnegative().max(limits.maxFileBytes).optional(),
          })
          .strict()
          .safeParse(range);
        if (!parsed.success)
          throw new ArtifactStoreError("ARTIFACT_RANGE_INVALID", "Artifact read range is invalid.");
        const stored = await resolveStored(principal, artifactId);
        const bytes = await verifiedRead(stored);
        if (parsed.data.offset > bytes.byteLength)
          throw new ArtifactStoreError(
            "ARTIFACT_RANGE_INVALID",
            "Artifact offset exceeds its size.",
          );
        const end = Math.min(
          bytes.byteLength,
          parsed.data.offset + (parsed.data.length ?? bytes.byteLength),
        );

        return {
          metadata: stored.metadata,
          bytes: bytes.slice(parsed.data.offset, end),
          offset: parsed.data.offset,
          totalSizeBytes: bytes.byteLength,
        };
      });
    const readForExecution = (context: ExecutionArtifactContext, artifactId: string) =>
      resultOf(async (): Promise<ExecutionArtifactRead> => {
        await assertLease(context);
        const stored = await resolveStored(context.lease, artifactId, context);
        const bytes = await verifiedRead(stored, context.signal);
        await assertLease(context);

        return { metadata: stored.metadata, bytes, offset: 0, totalSizeBytes: bytes.byteLength };
      });
    const writeProduced = (context: ExecutionProducedArtifactContext, payload: Payload) =>
      resultOf(async () => {
        await assertLease(context);
        if (!ExecutionPortIdSchema.safeParse(context.portId).success)
          throw new ArtifactStoreError(
            "ARTIFACT_CONTEXT_INVALID",
            "Artifact output port is invalid.",
          );
        const content = normalizedPayload(payload);
        const artifactId = randomUUID();
        const metadata = ExecutionArtifactSchema.parse({
          artifactId,
          jobId: context.lease.jobId,
          nodeId: context.nodeId,
          attemptId: context.attemptId,
          portId: context.portId,
          name: content.name,
          mimeType: content.mimeType,
          sizeBytes: content.sizeBytes,
          sha256: content.sha256,
          state: "validated",
          createdAt: new Date().toISOString(),
        });
        const storageKey = `jobs/${context.lease.jobId}/${context.attemptId}/${artifactId}`;

        return stageAndRegister(artifactId, async () => {
          await files.stage(storageKey, artifactId, content.bytes, context.signal);
          await assertLease(context);
          const registered = await persistenceResult(() =>
            persistence.registerArtifact(context.lease, { metadata, storageKey }),
          );
          assertArtifactNotAborted(context.signal);
          const stored = producedRow(registered, context);
          if (
            stored.storageKey !== storageKey ||
            JSON.stringify(stored.metadata) !== JSON.stringify(metadata)
          )
            throw new ArtifactStoreError(
              "ARTIFACT_METADATA_INVALID",
              "Artifact registration did not preserve the validated candidate.",
            );
          await outcome(artifactId, "registered");

          return stored.metadata as ExecutionArtifact;
        });
      });

    return {
      importInput: (
        principalInput: ExecutionPrincipal,
        input: Payload & { importRequestId: string },
      ) =>
        resultOf(async () => {
          const principal = principalWithScope(principalInput, "artifacts:import");
          if (!ExecutionRequestIdSchema.safeParse(input.importRequestId).success)
            throw new ArtifactStoreError(
              "ARTIFACT_IMPORT_INVALID",
              "Import request identifier must be a UUID.",
            );
          const content = normalizedPayload(input);
          const fields = {
            subjectId: principal.subjectId,
            workspaceId: principal.workspaceId,
            name: content.name,
            mimeType: content.mimeType,
            sizeBytes: content.sizeBytes,
            sha256: content.sha256,
          };
          const inputHash = inputFieldsHash(fields);
          const replay = await persistenceResult(() =>
            persistence.replayInputImport(principal, input.importRequestId, inputHash),
          );
          if (replay) {
            const stored = inputRow(principal, replay);
            if (
              replay.inputHash !== inputHash ||
              inputFieldsHash(stored.metadata as ExecutionInputAsset) !== inputHash
            )
              throw new ArtifactStoreError(
                "ARTIFACT_IMPORT_CONFLICT",
                "Import replay has different content.",
              );
            await verifiedRead(stored);

            return stored.metadata as ExecutionInputAsset;
          }
          const artifactId = randomUUID();
          const metadata = ExecutionInputAssetSchema.parse({
            artifactId,
            ...fields,
            createdAt: new Date().toISOString(),
          });
          const storageKey = `inputs/${artifactId}`;

          return stageAndRegister(artifactId, async () => {
            await files.stage(storageKey, artifactId, content.bytes);
            const registered = await persistenceResult(() =>
              persistence.createInputAsset(principal, {
                artifactId,
                metadata,
                storageKey,
                importRequestId: input.importRequestId,
                inputHash,
              }),
            );
            const stored = inputRow(principal, registered);
            if (
              registered.inputHash !== inputHash ||
              inputFieldsHash(stored.metadata as ExecutionInputAsset) !== inputHash
            )
              throw new ArtifactStoreError(
                "ARTIFACT_IMPORT_CONFLICT",
                "Import registration has different content.",
              );
            await outcome(
              artifactId,
              registered.artifactId === artifactId ? "registered" : "orphaned",
            );
            await verifiedRead(stored);

            return stored.metadata as ExecutionInputAsset;
          });
        }),
      getInputSnapshot: (principal: ExecutionPrincipal, artifactId: string) =>
        readArtifact(principal, artifactId).map(({ metadata }) =>
          ExecutionInputArtifactSnapshotSchema.parse({
            ...fingerprint(metadata),
            name: metadata.name,
            source:
              "jobId" in metadata
                ? {
                    kind: "job_artifact",
                    jobId: metadata.jobId,
                    nodeId: metadata.nodeId,
                    portId: metadata.portId,
                    attemptId: metadata.attemptId,
                  }
                : { kind: "input_asset" },
          }),
        ),
      createAttemptWorkspace: (context: ExecutionArtifactContext) =>
        resultOf(async () => {
          await assertLease(context);
          const workspace = await files.ensureDirectory(
            `workspaces/${context.lease.jobId}/${context.attemptId}`,
          );
          await assertLease(context);

          return workspace;
        }),
      writeProduced,
      registerProducedFile: (
        context: ExecutionProducedArtifactContext,
        input: Pick<ExecutionArtifact, "name" | "mimeType"> & { relativePath: string },
      ) =>
        resultOf(async () => {
          await assertLease(context);
          const relative = validateAttemptRelativePath(input.relativePath);
          const bytes = await limitedRead(() =>
            files.readVerifiedFile(
              `workspaces/${context.lease.jobId}/${context.attemptId}/${relative}`,
              context.signal,
            ),
          );
          const result = await writeProduced(context, {
            name: input.name,
            mimeType: input.mimeType,
            bytes,
          });
          if (result.isErr()) throw result.error;

          return result.value;
        }),
      readArtifact,
      readForExecution,
      metadataForExecution: (context: ExecutionArtifactContext, artifactId: string) =>
        readForExecution(context, artifactId).map(({ metadata }) => fingerprint(metadata)),
      metadataForJob: (context: ExecutionArtifactJobContext, artifactId: string) =>
        resultOf(async () => {
          await assertJobLease(context);
          const stored = await resolveStored(context.lease, artifactId, context);
          await verifiedRead(stored, context.signal);
          await assertJobLease(context);

          return fingerprint(stored.metadata);
        }),
    };
  });
