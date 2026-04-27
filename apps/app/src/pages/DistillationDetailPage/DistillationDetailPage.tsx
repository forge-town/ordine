import { Link, useNavigate } from "@tanstack/react-router";
import { useOne, useCustomMutation } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { Distillation } from "@repo/schemas";
import { buttonVariants } from "@repo/ui/button";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";
import { Database, Sparkles, Loader2 } from "lucide-react";
import { DistillationResultPanel } from "@/components/DistillationResultPanel";
import { InputSnapshotPanel } from "@/components/InputSnapshotPanel";
import { AgentRunsPanel } from "@/pages/JobDetailPage/AgentRunsPanel";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/distillations.$distillationId";

export const DistillationDetailPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { distillationId } = Route.useParams();
  const { mutate: optimizePipeline, mutation: optimizeMutation } = useCustomMutation();
  const isOptimizing = optimizeMutation.isPending;
  const { result: distillationResult, query: distillationQuery } = useOne<Distillation>({
    resource: ResourceName.distillations,
    id: distillationId,
  });
  const distillation = distillationResult ?? null;

  if (distillationQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("distillations.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!distillation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("distillations.notFound")}
      </div>
    );
  }

  const handleOptimizePipeline = () => {
    optimizePipeline(
      {
        url: "pipelines/optimizeFromDistillation",
        method: "post",
        values: { distillationId: distillation.id },
      },
      {
        onSuccess: (data) => {
          const pipeline = data.data as { id: string };
          void navigate({ to: "/pipelines/$pipelineId", params: { pipelineId: pipeline.id } });
        },
      },
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            {distillation.result && (
              <Button
                disabled={isOptimizing}
                onClick={handleOptimizePipeline}
                size="sm"
                variant="default"
              >
                {isOptimizing ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isOptimizing ? t("distillations.optimizing") : t("distillations.optimizePipeline")}
              </Button>
            )}
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              search={{ distillationId: distillation.id }}
              to="/distillations/new"
            >
              {t("distillations.openInStudio")}
            </Link>
          </div>
        }
        backTo="/distillations"
        title={distillation.title}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{distillation.status}</Badge>
              <Badge variant="outline">{distillation.mode}</Badge>
              <Badge variant="outline">{distillation.sourceType}</Badge>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("distillations.summaryLabel")}
              </div>
              <p className="mt-1 text-sm text-foreground">{distillation.summary || "—"}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.sourceId")}
                </div>
                <p className="mt-1 break-all text-sm text-foreground">
                  {distillation.sourceId ?? "—"}
                </p>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.sourceLabel")}
                </div>
                <p className="mt-1 text-sm text-foreground">{distillation.sourceLabel || "—"}</p>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("distillations.objectiveLabel")}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {distillation.config.objective || "—"}
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                {t("distillations.inputSnapshotLabel")}
              </div>
              <InputSnapshotPanel data={distillation.inputSnapshot} />
            </div>
          </Card>

          <DistillationResultPanel
            distillation={distillation}
            hint={t("distillations.detailResultHint")}
          />
        </div>

        {distillation.sourceType === "job" && distillation.sourceId && (
          <div className="mt-6 max-w-7xl">
            <AgentRunsPanel jobId={distillation.sourceId} />
          </div>
        )}
      </div>
    </div>
  );
};
