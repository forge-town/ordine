import { createFileRoute } from "@tanstack/react-router";
import { db } from "@repo/db";
import { usersTable } from "@repo/db-schema";
import { auth } from "@/integrations/better-auth";
import { getServerEnv } from "@/integrations/server-env";
import { count } from "drizzle-orm";

const LOCAL_USER_EMAIL = "local@ordine.local";
const LOCAL_USER_NAME = "Local User";
const LOCAL_USER_PASSWORD = "ordine-local-mode";

export const Route = createFileRoute("/api/local-session")({
  server: {
    handlers: {
      // TODO: This endpoint creates a user and establishes a session on first
      // call — semantically it should be a POST, not GET. Also, DB and Better
      // Auth calls should be wrapped with neverthrow for explicit error
      // handling instead of returning generic 500s.
      GET: async ({ request }) => {
        const { ORDINE_LOCAL_MODE } = getServerEnv();

        if (!ORDINE_LOCAL_MODE) {
          return new Response(JSON.stringify({ error: "Local mode is not enabled" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Check if any users exist
        const [result] = await db.select({ value: count() }).from(usersTable);
        const userCount = result?.value ?? 0;

        // If no users exist, create the local user via Better Auth
        if (userCount === 0) {
          const signUpReq = new Request(new URL("/api/auth/sign-up/email", request.url), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: LOCAL_USER_EMAIL,
              password: LOCAL_USER_PASSWORD,
              name: LOCAL_USER_NAME,
            }),
          });
          const signUpRes = await auth.handler(signUpReq);
          if (!signUpRes.ok) {
            return new Response(JSON.stringify({ error: "Failed to create local user" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          // Return the sign-up response which includes the session cookie
          return signUpRes;
        }

        // User exists, sign in
        const signInReq = new Request(new URL("/api/auth/sign-in/email", request.url), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: LOCAL_USER_EMAIL,
            password: LOCAL_USER_PASSWORD,
          }),
        });
        const signInRes = await auth.handler(signInReq);

        return signInRes;
      },
    },
  },
});
