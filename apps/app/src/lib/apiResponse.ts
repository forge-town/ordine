import { ok, err, type Result, ResultAsync } from "neverthrow";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const errorResponse = (message: string, status: number) => json({ error: message }, status);

export const parseJsonBody = (request: Request): ResultAsync<unknown, Response> => {
  return ResultAsync.fromPromise(
    request.json(),
    () => errorResponse("Invalid JSON body", 400)
  );
};
