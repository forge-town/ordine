import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => {
  return <div>Hello "/assistant"!</div>;
};

export const Route = createFileRoute("/_layout/assistant")({
  head: () => ({
    meta: [{ title: "Assistant | Ordine" }],
  }),
  component: RouteComponent,
});
