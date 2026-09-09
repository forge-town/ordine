import { err, Result, ResultAsync } from "neverthrow";
import { executionError } from "./errors";

export const EXECUTION_JSON_MAX_BYTES = 2 * 1024 * 1024;
export const INPUT_ASSET_JSON_MAX_BYTES = 12 * 1024 * 1024;

/** Count real streamed bytes even if Content-Length is absent or dishonest. */
export const readExecutionJson = async (request: Request, maxBytes = EXECUTION_JSON_MAX_BYTES) => {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return err(
      executionError("EXECUTION_CONTENT_TYPE_INVALID", "Content-Type must be application/json."),
    );
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length))))
    return err(executionError("EXECUTION_CONTENT_LENGTH_INVALID", "Content-Length is invalid."));
  if (length !== null && Number(length) > maxBytes)
    return err(
      executionError("EXECUTION_BODY_TOO_LARGE", "Execution request body exceeds its size limit."),
    );
  const reader = request.body?.getReader();
  if (!reader)
    return err(executionError("EXECUTION_JSON_INVALID", "A JSON request body is required."));
  const chunks: Uint8Array[] = [];
  const state = { size: 0, offset: 0 };
  while (true) {
    const chunk = await ResultAsync.fromPromise(reader.read(), () =>
      executionError("EXECUTION_BODY_UNREADABLE", "Execution request body could not be read."),
    );
    if (chunk.isErr()) {
      await ResultAsync.fromPromise(reader.cancel(), () => undefined);

      return err(chunk.error);
    }
    if (chunk.value.done) break;
    state.size += chunk.value.value.byteLength;
    if (state.size > maxBytes) {
      await ResultAsync.fromPromise(reader.cancel(), () => undefined);

      return err(
        executionError(
          "EXECUTION_BODY_TOO_LARGE",
          "Execution request body exceeds its size limit.",
        ),
      );
    }
    chunks.push(chunk.value.value);
  }
  reader.releaseLock();
  const bytes = new Uint8Array(state.size);
  for (const chunk of chunks) {
    bytes.set(chunk, state.offset);
    state.offset += chunk.byteLength;
  }

  return Result.fromThrowable(
    () => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown,
    () =>
      executionError(
        "EXECUTION_JSON_INVALID",
        "Execution request body must contain valid UTF-8 JSON.",
      ),
  )();
};
