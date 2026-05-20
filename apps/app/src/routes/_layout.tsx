import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import ky from "ky";
import { AppLayout } from "@/components/AppLayout";
import { getSession } from "@/integrations/better-auth-client";

export const Route = createFileRoute("/_layout")({
  beforeLoad: async () => {
    // Skip server-side — session cookies are only available in the browser
    if (globalThis.document === undefined) return;

    const { data: session } = await getSession();
    if (session) return;

    // Attempt local auto-login (404s when ORDINE_LOCAL_MODE is off)
    try {
      await ky.get("/api/local-session", { credentials: "include" });
      globalThis.location.reload();
      await new Promise(() => {}); // suspend until reload completes
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
