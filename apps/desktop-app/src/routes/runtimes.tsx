import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/runtimes")({
  component: () => <div>Runtimes</div>,
});
