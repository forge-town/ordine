import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { ExecutionActorError } from "./errors";
import type { ExecutionActorContext } from "./types";
const assertActive = (context: ExecutionActorContext) => {
  if (context.signal.aborted)
    throw new ExecutionActorError("CANCELLED", "Execution was cancelled.");
};
export const verifyPreparedExecutable = async (context: ExecutionActorContext): Promise<string> => {
  const executable = context.resolved.executablePath;
  const expectedHash = context.resolved.executableSha256;
  if (
    !executable ||
    !isAbsolute(executable) ||
    !expectedHash ||
    !/^[a-f0-9]{64}$/u.test(expectedHash)
  )
    throw new ExecutionActorError(
      "EXECUTABLE_NOT_PREPARED",
      "Script execution requires a frozen absolute interpreter path and SHA256.",
      "preparation",
    );
  if (
    /\.(?:cmd|bat)$/iu.test(executable) ||
    (process.platform === "win32" && !/\.(?:exe|com)$/iu.test(executable))
  )
    throw new ExecutionActorError(
      "EXECUTABLE_UNSUPPORTED",
      "Script interpreters must be executable binaries; command shims are not supported.",
      "preparation",
    );
  const before = await lstat(executable, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.size > 512n * 1024n * 1024n)
    throw new ExecutionActorError(
      "EXECUTABLE_UNSUPPORTED",
      "Script interpreter is not a supported regular executable file.",
      "preparation",
    );
  const hash = createHash("sha256");
  const stream = createReadStream(executable, { signal: context.signal });
  for await (const bytes of stream) {
    assertActive(context);
    hash.update(bytes);
  }
  const after = await lstat(executable, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    hash.digest("hex") !== expectedHash
  )
    throw new ExecutionActorError(
      "EXECUTABLE_CHANGED",
      "Script interpreter no longer matches its prepared fingerprint.",
      "preparation",
    );

  return executable;
};
