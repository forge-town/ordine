import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@repo/views/AppLayout";

export const Route = createRootRoute({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
