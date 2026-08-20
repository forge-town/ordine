import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { useOne } from "@refinedev/core";
import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";
import { z } from "zod/v4";
import { Button } from "@repo/ui/button";
import type { PipelineData } from "@repo/schemas";
import { CanvasPage } from "@repo/views/CanvasPage";
import { PageLoadingState } from "@repo/views/PageLoadingState";
import { PageState } from "@repo/views/PageState";
import { AppLayout } from "@/components/AppLayout";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSession } from "@/integrations/better-auth-client";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";
import { materializeGeneratedPipeline } from "@/lib/materializeGeneratedPipeline";
import { toastStore } from "@/store/toastStore";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";

const CanvasRouteComponent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: id ?? "",
    queryOptions: { enabled: !!id && !!session },
  });
  const pipeline = id ? (pipelineResult ?? null) : null;
  const handlePipelineRetry = () => void pipelineQuery?.refetch();
  const handleGeneratedPipeline = useCallback(
    async (generatedPipelineId: string) => {
      const result = await ResultAsync.fromPromise(
        materializeGeneratedPipeline(
          generatedPipelineId,
          sharedSidebarStore.getState().currentProjectId,
        ),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );
      await result.match(
        async (pipelineId) => {
          await navigate({ to: "/canvas", search: { id: pipelineId } });
        },
        (error) => {
          toastStore.getState().addToast({
            type: "error",
            title: t("canvas.agentPanel.errorTitle"),
            description: error.message,
          });
        },
      );
    },
    [navigate, t],
  );

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!id) {
    return (
      <AppLayout>
        <CanvasPage
          embedded
          showCanvasMiniSidebar={false}
          onGeneratedPipeline={handleGeneratedPipeline}
        />
      </AppLayout>
    );
  }

  if (id && pipelineQuery?.isLoading) {
    return (
      <AppLayout>
        <PageLoadingState variant="detail" />
      </AppLayout>
    );
  }

  if (pipelineQuery?.isError) {
    return (
      <AppLayout>
        <div className="grid h-full w-full place-items-center bg-background p-6">
          <PageState
            action={
              <Button size="sm" variant="outline" onClick={handlePipelineRetry}>
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            }
            className="w-full max-w-lg"
            description={t("canvas.pipelineLoadFailedDescription")}
            icon={<AlertTriangle />}
            title={t("canvas.pipelineLoadFailed")}
          />
        </div>
      </AppLayout>
    );
  }

  if (!pipeline) {
    return (
      <AppLayout>
        <div className="grid h-full w-full place-items-center bg-background p-6">
          <PageState
            action={
              <Button size="sm" variant="outline" onClick={handlePipelineRetry}>
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            }
            className="w-full max-w-lg"
            description={t("canvas.pipelineNotFoundDescription")}
            icon={<SearchX />}
            title={t("canvas.pipelineNotFound")}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <CanvasPage
        embedded
        id={id}
        showCanvasMiniSidebar={false}
        onGeneratedPipeline={handleGeneratedPipeline}
      />
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
