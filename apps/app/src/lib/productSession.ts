import { ResultAsync } from "neverthrow";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";

/** Server-side session gate shared by authoring and Agent HTTP routes. */
export const getProductSession = async (request: Request) => {
  const session = await ResultAsync.fromPromise(
    auth.api.getSession({ headers: request.headers }),
    () => new Error("Session unavailable"),
  );
  if (session.isErr() || !session.value)
    return { response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const env = getServerEnv();
  if (
    env.ORDINE_EXECUTION_API_TARGET &&
    (!env.ORDINE_EXECUTION_OWNER_USER_ID ||
      session.value.user.id !== env.ORDINE_EXECUTION_OWNER_USER_ID)
  )
    return { response: Response.json({ error: "此会话未绑定当前工作区。" }, { status: 403 }) };
  const origin = new URL(env.VITE_APP_URL).origin;
  if (
    new URL(request.url).origin !== origin ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== origin)
  )
    return { response: Response.json({ error: "Invalid request origin" }, { status: 403 }) };

  return { session: session.value };
};
