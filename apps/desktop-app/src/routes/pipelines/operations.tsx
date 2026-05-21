import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pipelines/operations")({
  component: () => <div>Operations</div>,
});
