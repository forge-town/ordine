import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";

export const Route = createFileRoute("/_layout")({
  beforeLoad: ({ context }) => requireAuthenticatedSession(context),
  ssr: false,
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
