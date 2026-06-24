import { createFileRoute } from "@tanstack/react-router";
import { CanvasPage } from "@repo/views/CanvasPage";

export const Route = createFileRoute("/canvas")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: search.id as string | undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useSearch();

  return <CanvasPage id={id} />;
}
