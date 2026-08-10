import { redirect } from "@tanstack/react-router";
import ky from "ky";
import { ResultAsync } from "neverthrow";
import type { RouterContext } from "./__root";

export const requireAuthenticatedSession = async (context: RouterContext) => {
  if (context.session) {
    return;
  }

  if (globalThis.document === undefined) {
    if (context.isLocalMode) {
      return;
    }

    throw redirect({ to: "/login" });
  }

  const result = await ResultAsync.fromPromise(
    ky.get("/api/local-session", { credentials: "include" }),
    () => new Error("local-session-failed"),
  );

  if (result.isErr()) {
    throw redirect({ to: "/login" });
  }

  globalThis.location.reload();
  await new Promise(() => {});
};
