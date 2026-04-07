import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => {
  return <div>Hello "/settings"!</div>;
};

export const Route = createFileRoute("/settings")({
  component: RouteComponent,
});
