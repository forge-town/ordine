import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { CanvasPage } from "@repo/views/CanvasPage";
import { AppLayout } from "@/components/AppLayout";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { useSession } from "@/integrations/better-auth-client";
import { webPlatform } from "@/integrations/platform";
import { requireAuthenticatedSession } from "./-requireAuthenticatedSession";
import { createMaterializeGeneratedPipeline } from "@repo/views/lib/materializeGeneratedPipeline";
import { createPipelineAgentSessionsClient } from "@repo/views/lib/pipelineAgentSessionsClient";
import { toastStore } from "@/store/toastStore";
import { sidebarStore as sharedSidebarStore } from "@repo/views/store/sidebarStore";

const pipelineAgentSessionsClient = createPipelineAgentSessionsClient(webPlatform);
const materializeGeneratedPipeline = createMaterializeGeneratedPipeline({
  client: pipelineAgentSessionsClient,
  dataProvider,
});

const CanvasRouteComponent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { data: session, isPending } = useSession();
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
