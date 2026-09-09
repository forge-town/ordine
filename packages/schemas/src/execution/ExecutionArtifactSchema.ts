import { z } from "zod/v4";
import {
  ExecutionIdentifierSchema,
  ExecutionPortIdSchema,
  ExecutionTimestampSchema,
} from "./ExecutionProtocolSchema";

export const ExecutionArtifactStateSchema = z.enum([
  "staged",
  "validated",
  "published",
  "rejected",
]);
export type ExecutionArtifactState = z.infer<typeof ExecutionArtifactStateSchema>;

export const ExecutionArtifactNameSchema = z
  .string()
  .min(1)
  .max(240)
  .refine(
    (value) =>
      value === value.trim() &&
      !/[\\/:*?"<>|\p{Cc}]/u.test(value) &&
      !/[. ]$/u.test(value) &&
      !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(value),
    "Artifact display name must be a safe filename, not a path",
  );

/** Public metadata deliberately has no server path or storage key. */
export const ExecutionArtifactSchema = z.strictObject({
  artifactId: ExecutionIdentifierSchema,
  jobId: ExecutionIdentifierSchema,
  nodeId: ExecutionIdentifierSchema,
  portId: ExecutionPortIdSchema,
  attemptId: ExecutionIdentifierSchema,
  name: ExecutionArtifactNameSchema,
  mimeType: z.string().min(1).max(128),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  state: ExecutionArtifactStateSchema,
  createdAt: ExecutionTimestampSchema,
});
export type ExecutionArtifact = z.infer<typeof ExecutionArtifactSchema>;
