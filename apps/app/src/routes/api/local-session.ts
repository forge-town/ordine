import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync, type Result } from "neverthrow";
import { db } from "@repo/db";
import { usersTable } from "@repo/db-schema";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";

const LOCAL_USER_EMAIL = "local@ordine.local";
const LOCAL_USER_NAME = "Local User";
const LOCAL_USER_PASSWORD = "ordine-local-mode";

const localUserInitialization = {
  promise: null as PromiseLike<Result<void, Error>> | null,
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error("Local user initialization failed");

const createAuthRequest = (requestUrl: string, action: "sign-in" | "sign-up") =>
  new Request(new URL(`/api/auth/${action}/email`, requestUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: LOCAL_USER_EMAIL,
      password: LOCAL_USER_PASSWORD,
      ...(action === "sign-up" ? { name: LOCAL_USER_NAME } : {}),
    }),
  });

const ensureLocalUser = (requestUrl: string) => {
  if (localUserInitialization.promise) {
    return localUserInitialization.promise;
  }

  const initialization: ResultAsync<void, Error> = ResultAsync.fromPromise(
    db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, LOCAL_USER_EMAIL))
      .limit(1),
    toError,
  ).andThen((users) => {
    if (users.length > 0) {
      return okAsync<void, Error>(undefined);
    }

    return ResultAsync.fromPromise(
      auth.handler(createAuthRequest(requestUrl, "sign-up")),
      toError,
    ).andThen((response) =>
      response.ok
        ? okAsync<void, Error>(undefined)
        : errAsync<void, Error>(new Error("Failed to create local user")),
    );
  });
  const promise: Promise<Result<void, Error>> = Promise.resolve(initialization).then((result) => {
    localUserInitialization.promise = null;

    return result;
  });
  localUserInitialization.promise = promise;

  return promise;
};

export const handleLocalSessionRequest = async (request: Request) => {
  const { ORDINE_LOCAL_MODE } = getServerEnv();

  if (!ORDINE_LOCAL_MODE) {
    return new Response(JSON.stringify({ error: "Local mode is not enabled" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const initialization = await ensureLocalUser(request.url);
  if (initialization.isErr()) {
    return new Response(JSON.stringify({ error: initialization.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signIn = await ResultAsync.fromPromise(
    auth.handler(createAuthRequest(request.url, "sign-in")),
    toError,
  );
  if (signIn.isErr()) {
    return new Response(JSON.stringify({ error: signIn.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return signIn.value;
};

export const Route = createFileRoute("/api/local-session")({
  server: {
    handlers: {
      // TODO: This endpoint creates a user and establishes a session on first
      // call — semantically it should be a POST, not GET. Also, DB and Better
      // Auth calls should be wrapped with neverthrow for explicit error
      // handling instead of returning generic 500s.
      GET: ({ request }) => handleLocalSessionRequest(request),
    },
  },
});
