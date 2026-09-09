import type { ExecutionArtifactRecord, ExecutionInputAssetRecord } from "@repo/db-schema";
import type { ExecutionIdentity, ExecutionLease } from "@repo/models";
import type { ExecutionArtifact, ExecutionInputAsset, ExecutionPrincipal } from "@repo/schemas";

export type ExecutionArtifactJobContext = {
  lease: ExecutionLease;
  signal: AbortSignal;
};
export type ExecutionArtifactContext = ExecutionArtifactJobContext & {
  nodeId: ExecutionArtifact["nodeId"];
  attemptId: ExecutionArtifact["attemptId"];
};
export type ExecutionProducedArtifactContext = ExecutionArtifactContext &
  Pick<ExecutionArtifact, "portId">;
export type ExecutionArtifactPersistence = {
  replayInputImport: (
    principal: ExecutionPrincipal,
    importRequestId: string,
    inputHash: string,
  ) => Promise<ExecutionInputAssetRecord | null>;
  createInputAsset: (
    principal: ExecutionPrincipal,
    data: Omit<ExecutionInputAssetRecord, "subjectId" | "workspaceId">,
  ) => Promise<ExecutionInputAssetRecord>;
  getInputAsset: (
    identity: ExecutionIdentity,
    artifactId: string,
  ) => Promise<ExecutionInputAssetRecord | null>;
  /** Must restrict ownership using the supplied identity, including the owning Job of a produced artifact. */
  getProducedArtifact: (
    identity: ExecutionIdentity,
    artifactId: string,
    access: { lease?: ExecutionLease },
  ) => Promise<ExecutionArtifactRecord | null>;
  /** Repository must check active lease and Job/attempt ownership in the registration transaction. */
  registerArtifact: (
    lease: ExecutionLease,
    data: Pick<ExecutionArtifactRecord, "metadata" | "storageKey">,
  ) => Promise<ExecutionArtifactRecord>;
  assertLease: (context: ExecutionArtifactContext) => Promise<void>;
  assertJobLease: (lease: ExecutionLease) => Promise<void>;
};
export type ExecutionArtifactRead = {
  metadata: ExecutionArtifact | ExecutionInputAsset;
  bytes: Uint8Array;
  offset: number;
  totalSizeBytes: number;
};
export type ExecutionArtifactFingerprint = Pick<
  ExecutionArtifact,
  "artifactId" | "mimeType" | "sizeBytes" | "sha256"
>;
