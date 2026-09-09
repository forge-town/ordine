import { createHash } from "node:crypto";
import { open, realpath } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { ResultAsync } from "neverthrow";
import {
  executionFailure,
  executionServiceResult,
  toExecutionServiceError,
  ExecutionServiceFailure,
} from "./serviceResult";

/** Resolve once at preparation and retain the actual executable identity in PreparedRun. */
export const fingerprintExecutable = (path: string) =>
  executionServiceResult(async () => {
    if (!isAbsolute(path) || /\.(?:cmd|bat|ps1)$/iu.test(path))
      executionFailure(
        "EXECUTABLE_INVALID",
        "An absolute native executable path is required",
        "executablePath",
      );
    const canonical = await realpath(path);
    const handle = await open(canonical, "r");
    const measured = await ResultAsync.fromPromise(
      (async () => {
        const before = await handle.stat();
        if (!before.isFile() || before.size <= 0 || before.size > 512 * 1024 * 1024)
          executionFailure(
            "EXECUTABLE_INVALID",
            "Executable is not a bounded regular file",
            "executablePath",
          );
        const hash = createHash("sha256");
        const counts = { bytes: 0 };
        const buffer = Buffer.alloc(1024 * 1024);
        for (;;) {
          const read = await handle.read(buffer, 0, buffer.length, null);
          if (!read.bytesRead) break;
          counts.bytes += read.bytesRead;
          if (counts.bytes > before.size)
            executionFailure("EXECUTABLE_CHANGED", "Executable changed while being prepared");
          hash.update(buffer.subarray(0, read.bytesRead));
        }
        const after = await handle.stat();
        if (
          counts.bytes !== before.size ||
          before.size !== after.size ||
          before.mtimeMs !== after.mtimeMs ||
          before.ctimeMs !== after.ctimeMs ||
          (await realpath(path)) !== canonical
        )
          executionFailure("EXECUTABLE_CHANGED", "Executable changed while being prepared");

        return { executablePath: canonical, executableSha256: hash.digest("hex") };
      })(),
      toExecutionServiceError,
    );
    const closed = await ResultAsync.fromPromise(handle.close(), toExecutionServiceError);
    if (measured.isErr()) throw new ExecutionServiceFailure(measured.error);
    if (closed.isErr())
      executionFailure("EXECUTABLE_READ_FAILED", "Executable could not be verified");

    return measured.value;
  });
