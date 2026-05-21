import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/distillations/$distillationId")({
  component: () => <div>Distillation Detail</div>,
});
