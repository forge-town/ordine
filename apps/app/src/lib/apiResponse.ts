import { ok, err, type Result } from "neverthrow";

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const errorResponse = (message: string, status: number) => json({ error: message }, status);

export const parseJsonBody = async (request: Request): Promise<Result<unknown, Response>> => {
  try {
    const body: unknown = await request.json();
    return ok(body);
  } catch {
    return err(errorResponse("Invalid JSON body", 400));
  }
};
