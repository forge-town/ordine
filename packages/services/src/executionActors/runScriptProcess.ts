import { ExecutionActorError } from "./errors";
import { runNativeProcess } from "./runNativeProcess";
import type { ExecutionActorContext, ExecutionActorLimits } from "./types";
export const runScriptProcess = (input: {
  context: ExecutionActorContext;
  workspace: string;
  sourcePath: string;
  stdin: Uint8Array;
  limits: ExecutionActorLimits;
}) => {
  const executor = input.context.operation.executor;
  if (executor.kind !== "script")
    throw new ExecutionActorError("EXECUTOR_KIND_INVALID", "Script executor was required.");

  return runNativeProcess({
    ...input,
    arguments: [
      ...(executor.language === "python"
        ? ["-I", "-u", "-X", "utf8"]
        : executor.language === "bash"
          ? ["--noprofile", "--norc"]
          : ["--no-addons"]),
      input.sourcePath,
    ],
  });
};
