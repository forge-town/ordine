import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useOne } from "@refinedev/core";
import { z } from "zod/v4";
import type { PipelineData } from "@repo/schemas";
import { CanvasPage } from "@repo/views/CanvasPage";
import { PageLoadingState } from "@repo/views/PageLoadingState";
import { ToastContainer } from "@/components/ToastContainer";
import { CanvasRoot } from "@/pages/WorkspacePage/canvas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSession } from "@/integrations/better-auth-client";
import { ToastStoreProvider } from "@/store/toastStore";

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
    return <CanvasPage />;
  }

  if (id && pipelineQuery?.isLoading) {
    return (
      <div className="fixed inset-0 flex h-screen w-screen bg-background">
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="fixed inset-0 flex h-screen w-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Pipeline not found</p>
      </div>
    );
  }

  return (
    <ToastStoreProvider>
      <div className="fixed inset-0 h-screen w-screen overflow-hidden">
        <CanvasRoot pipeline={pipeline} />
        <ToastContainer />
      </div>
    </ToastStoreProvider>
  );
};

export const Route = createFileRoute("/canvas")({
  head: () => ({
    meta: [{ title: "Canvas | Ordine" }],
  }),
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  component: CanvasRouteComponent,
});
