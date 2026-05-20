import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import ky from "ky";
import { ResultAsync } from "neverthrow";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async ({ context }) => {
    if (context.session) {
      return;
    }

    // Server-side: local mode allows access without session
    if (globalThis.document === undefined) {
      if (context.isLocalMode) {
        return;
      }

      throw redirect({ to: "/login" });
    }

    // Client-side: attempt local auto-login (404s when ORDINE_LOCAL_MODE is off)
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
