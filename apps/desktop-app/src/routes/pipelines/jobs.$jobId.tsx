import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pipelines/jobs/$jobId")({
  component: () => <div>Job Detail</div>,
});
