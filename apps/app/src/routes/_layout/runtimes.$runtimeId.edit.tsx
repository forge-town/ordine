import { createFileRoute } from "@tanstack/react-router";
import { RuntimeEditPage } from "@/pages/RuntimeEditPage";

export const Route = createFileRoute("/_layout/runtimes/$runtimeId/edit")({
  component: RuntimeEditPage,
});
