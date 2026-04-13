import { ok, err, Result } from "neverthrow";

function parseJSON(raw: string): Result<Data, ParseError> {
  try {
    return ok(JSON.parse(raw));
  } catch {
    return err(new ParseError("Invalid JSON", raw));
  }
}

parseJSON(input).match(
  (data) => handleSuccess(data),
  (error) => handleError(error.message),
);
