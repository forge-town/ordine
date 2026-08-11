import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useOne } from "@refinedev/core";
import { z } from "zod/v4";
import type { PipelineData } from "@repo/schemas";
import { CanvasPage } from "@repo/views/CanvasPage";
import { PageLoadingState } from "@repo/views/PageLoadingState";
import { AppLayout } from "@/components/AppLayout";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSession } from "@/integrations/better-auth-client";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";

const CanvasRouteComponent = () => {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id && !!session },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!id) {
    return (
      <AppLayout canvasMode>
        <CanvasPage embedded />
      </AppLayout>
    );
  }

  if (id && pipelineQuery?.isLoading) {
    return (
      <AppLayout canvasMode>
        <PageLoadingState variant="detail" />
      </AppLayout>
    );
  }

  if (!pipeline) {
    return (
      <AppLayout canvasMode>
        <div className="flex h-full w-full items-center justify-center bg-background">
          <p className="text-sm text-muted-foreground">Pipeline not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout canvasMode>
      <CanvasPage embedded id={id} />
    </AppLayout>
  );
};

export const Route = createFileRoute("/canvas")({
  beforeLoad: ({ context }) => requireAuthenticatedSession(context),
  ssr: false,
  head: () => ({
    meta: [{ title: "Canvas | Ordine" }],
  }),
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  component: CanvasRouteComponent,
});
