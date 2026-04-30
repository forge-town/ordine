import { createFileRoute } from "@tanstack/react-router";
import { RuntimeDetailPage } from "@/pages/RuntimeDetailPage";

export const Route = createFileRoute("/_layout/runtimes/$runtimeId")({
  component: RuntimeDetailPage,
});
