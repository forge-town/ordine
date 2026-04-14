import { Result } from "neverthrow";

export const safeJsonParse = <T = unknown>(raw: string): Result<T, SyntaxError> =>
  Result.fromThrowable(JSON.parse, (error) =>
    error instanceof SyntaxError ? error : new SyntaxError(String(error))
  )(raw).map((v) => v as T);
