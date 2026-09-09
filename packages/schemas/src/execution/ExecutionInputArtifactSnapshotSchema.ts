import { z } from "zod/v4";
import { ExecutionArtifactNameSchema } from "./ExecutionArtifactSchema";
import { ExecutionIdentifierSchema, ExecutionPortIdSchema } from "./ExecutionProtocolSchema";

export const ExecutionInputArtifactSnapshotSchema = z.strictObject({
  artifactId: ExecutionIdentifierSchema,
  name: ExecutionArtifactNameSchema,
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("input_asset") }),
    z.strictObject({
      kind: z.literal("job_artifact"),
      jobId: ExecutionIdentifierSchema,
      nodeId: ExecutionIdentifierSchema,
      portId: ExecutionPortIdSchema,
      attemptId: ExecutionIdentifierSchema,
    }),
  ]),
});
export type ExecutionInputArtifactSnapshot = z.infer<typeof ExecutionInputArtifactSnapshotSchema>;
