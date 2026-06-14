import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ResultAsync, type Result } from "neverthrow";
import type { z } from "zod/v4";
import { ConflictError, NotFoundError } from "@repo/services";

const statusForError = (error: unknown): ContentfulStatusCode => {
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;

  return 500;
};

const messageForError = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed";

export const readJson = (c: Context) =>
  ResultAsync.fromPromise(c.req.json() as Promise<unknown>, () => new Error("Invalid JSON"));

export const validateJson = async <T extends z.ZodType>(c: Context, schema: T) => {
  const bodyResult = await readJson(c);
  const body = bodyResult.unwrapOr(undefined);

  return schema.safeParse(body);
};

export const validationErrorJson = (c: Context) => c.json({ error: "Invalid request" }, 400);

export const resultJson = <T>(
  c: Context,
  result: Result<T, unknown>,
  status: ContentfulStatusCode = 200,
) => {
  if (result.isErr()) {
    return c.json({ error: messageForError(result.error) }, statusForError(result.error));
  }

  return c.json(result.value, status);
};

export const resultNoContent = (c: Context, result: Result<unknown, unknown>) => {
  if (result.isErr()) {
    return c.json({ error: messageForError(result.error) }, statusForError(result.error));
  }

  return c.body(null, 204);
};
