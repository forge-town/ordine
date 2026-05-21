import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pipelines/objects")({
  component: () => <div>Objects</div>,
});
