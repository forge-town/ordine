import { createCancellationError } from "../createCancellationError";

export const runAbortable = <T>(promise: Promise<T>, signal: AbortSignal, sessionId: string) =>
  new Promise<T>((resolvePromise, rejectPromise) => {
    const handleAbort = () => rejectPromise(createCancellationError(sessionId));
    if (signal.aborted) {
      handleAbort();

      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolvePromise(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        rejectPromise(error);
      },
    );
  });
