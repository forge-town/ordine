import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/canvas")({
  component: () => <div>Canvas</div>,
});
