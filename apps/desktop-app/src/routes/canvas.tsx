import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

// Canvas is heavy (@xyflow/react); lazy-load it so it stays out of the initial bundle.
const CanvasPage = lazy(() =>
  import("@repo/views/CanvasPage").then((m) => ({ default: m.CanvasPage })),
);

export const Route = createFileRoute("/canvas")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: search.id as string | undefined,
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useSearch();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <CanvasPage id={id} />
    </Suspense>
  );
}
