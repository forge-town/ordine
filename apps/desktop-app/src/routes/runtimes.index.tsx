import { createFileRoute } from "@tanstack/react-router";
import { RuntimesPage } from "@repo/views/RuntimesPage";

export const Route = createFileRoute("/runtimes/")({
  component: RuntimesPage,
});
