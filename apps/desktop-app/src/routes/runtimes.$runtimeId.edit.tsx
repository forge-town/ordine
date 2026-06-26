import { createFileRoute } from "@tanstack/react-router";
import { RuntimeEditPage } from "@repo/views/RuntimeEditPage";

export const Route = createFileRoute("/runtimes/$runtimeId/edit")({
  component: RuntimeEditPage,
});
