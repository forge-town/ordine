import type { OperationAttemptContext } from "@repo/pipeline-engine";
import type { ExecutionError } from "@repo/schemas";
import type { Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import type {
  createExecutionArtifactStore,
  ExecutionArtifactContext,
  ArtifactStoreError,
} from "../executionArtifacts";

type ArtifactStore =
  ReturnType<typeof createExecutionArtifactStore> extends ResultAsync<infer T, ArtifactStoreError>
    ? T
    : never;
export type ExecutionActorContext = OperationAttemptContext & {
  sharedContext: string;
  credentialRefs?: string[];
  artifactContext: ExecutionArtifactContext;
};
export const ExecutionActorLimitsSchema = z.strictObject({
  maxStdoutBytes: z
    .number()
    .int()
    .positive()
    .max(16 * 1024 * 1024)
    .default(1024 * 1024),
  maxStderrBytes: z
    .number()
    .int()
    .positive()
    .max(16 * 1024 * 1024)
    .default(256 * 1024),
  maxOutputBytes: z
    .number()
    .int()
    .positive()
    .max(32 * 1024 * 1024)
    .default(1280 * 1024),
  maxInputBytes: z
    .number()
    .int()
    .positive()
    .max(32 * 1024 * 1024)
    .default(8 * 1024 * 1024),
  maxArtifactInputBytes: z
    .number()
    .int()
    .positive()
    .max(200 * 1024 * 1024)
    .default(50 * 1024 * 1024),
  maxDurationMs: z.number().int().positive().max(86_400_000).default(600_000),
  terminationTimeoutMs: z.number().int().min(1000).max(30_000).default(10_000),
});
export type ExecutionActorLimits = z.infer<typeof ExecutionActorLimitsSchema>;
export const ScriptProcessReportSchema = z.object({
  pid: z.number().int().positive().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  exitCode: z.number().int().nullable(),
  exitSignal: z.string().nullable(),
  stdoutBytes: z.number().int().nonnegative(),
  stderrBytes: z.number().int().nonnegative(),
  stderr: z.string(),
  failureCode: z.string().optional(),
});
export type ScriptProcessReport = z.infer<typeof ScriptProcessReportSchema>;
export type ExecutionActorDependencies = {
  artifactStore: Pick<
    ArtifactStore,
    "createAttemptWorkspace" | "readForExecution" | "writeProduced" | "registerProducedFile"
  >;
  limits?: z.input<typeof ExecutionActorLimitsSchema>;
  onProcessResult?: (
    context: ExecutionActorContext,
    report: ScriptProcessReport,
  ) => Promise<Result<void, ExecutionError>>;
};
