import { createFileRoute } from "@tanstack/react-router";
import { RuntimeDetailPage } from "@repo/views/RuntimeDetailPage";

export const Route = createFileRoute("/runtimes/$runtimeId/")({
  component: RuntimeDetailPage,
});
