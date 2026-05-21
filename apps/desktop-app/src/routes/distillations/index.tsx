import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/distillations/")({
  component: () => <div>Distillations</div>,
});
