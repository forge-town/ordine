import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/skills")({
  component: () => <div>Skills</div>,
});
