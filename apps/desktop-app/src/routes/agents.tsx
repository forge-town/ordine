import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/agents")({
  component: () => <div>Agents</div>,
});
