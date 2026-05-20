import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import ky from "ky";
import { ResultAsync } from "neverthrow";
import { AppLayout } from "@/components/AppLayout";
import { getSession } from "@/integrations/better-auth-client";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async () => {
    // Skip server-side — session cookies are only available in the browser
    if (globalThis.document === undefined) return;

    const { data: session } = await getSession();
    if (session) return;

    // Attempt local auto-login (404s when ORDINE_LOCAL_MODE is off)
    const result = await ResultAsync.fromPromise(
      ky.get("/api/local-session", { credentials: "include" }),
      () => new Error("local-session-failed"),
    );

    if (result.isErr()) {
      throw redirect({ to: "/login" });
    }

    globalThis.location.reload();
    await new Promise(() => {}); // suspend until reload completes
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
