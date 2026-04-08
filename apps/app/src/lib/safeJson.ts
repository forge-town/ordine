import { ok, err, type Result } from "neverthrow";

export const safeJsonParse = <T = unknown>(raw: string): Result<T, SyntaxError> => {
  try {
    return ok(JSON.parse(raw) as T);
  } catch (error) {
    return err(error instanceof SyntaxError ? error : new SyntaxError(String(error)));
  }
};
