import { createFileRoute } from "@tanstack/react-router";

// Placeholder so the shared CanvasPage can navigate to operation creation on
// desktop. Full operations pages migration is a separate follow-up.
export const Route = createFileRoute("/pipelines/operations/new")({
  component: () => <div>New Operation</div>,
});
