import { createFileRoute, redirect } from "@tanstack/react-router";
import ky from "ky";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { CanvasPage } from "@repo/views/CanvasPage";

export const Route = createFileRoute("/canvas")({
  // Mirror /_layout auth: use the server-loaded session and support local-mode
  // auto-login. (Canvas is a top-level full-screen route, so it can't inherit
  // the _layout guard and must replicate it — otherwise local mode bounces to
  // /login on navigation.)
  beforeLoad: async ({ context }) => {
    if (context.session) {
      return;
    }

    // Server-side: local mode allows access without a session.
    if (globalThis.document === undefined) {
      if (context.isLocalMode) {
        return;
      }

      throw redirect({ to: "/login" });
    }

    // Client-side: attempt local auto-login (404s when ORDINE_LOCAL_MODE is off).
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
  head: () => ({
    meta: [{ title: "Canvas | Ordine" }],
  }),
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  component: CanvasRouteComponent,
});

function CanvasRouteComponent() {
  const { id } = Route.useSearch();

  return <CanvasPage id={id} />;
}
