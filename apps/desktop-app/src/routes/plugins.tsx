import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/plugins")({
  component: () => <div>Plugins</div>,
});
