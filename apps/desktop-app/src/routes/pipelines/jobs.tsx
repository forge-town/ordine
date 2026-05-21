import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pipelines/jobs")({
  component: () => <div>Jobs</div>,
});
