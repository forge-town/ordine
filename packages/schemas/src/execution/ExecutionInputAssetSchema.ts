import { z } from "zod/v4";
import { ExecutionArtifactNameSchema } from "./ExecutionArtifactSchema";
import { ExecutionIdentifierSchema, ExecutionTimestampSchema } from "./ExecutionProtocolSchema";

/** Immutable uploaded/materialized input. It exists before approval and is not a fabricated Job. */
export const ExecutionInputAssetSchema = z.strictObject({
  artifactId: ExecutionIdentifierSchema,
  subjectId: ExecutionIdentifierSchema,
  workspaceId: ExecutionIdentifierSchema,
  name: ExecutionArtifactNameSchema,
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  createdAt: ExecutionTimestampSchema,
});
export type ExecutionInputAsset = z.infer<typeof ExecutionInputAssetSchema>;
