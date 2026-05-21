import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pipelines/")({
  component: () => <div>Pipelines</div>,
});
