import { Link } from "@tanstack/react-router";
import { useOne } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { Distillation } from "@repo/schemas";
import { buttonVariants } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";
import { DistillationResultPanel } from "@/components/DistillationResultPanel";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/distillations.$distillationId";

export const DistillationDetailPage = () => {
  const { t } = useTranslation();
  const { distillationId } = Route.useParams();
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            search={{ distillationId: distillation.id }}
            to="/distillations/new"
          >
            {t("distillations.openInStudio")}
          </Link>
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
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("distillations.inputSnapshotLabel")}
              </div>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                {JSON.stringify(distillation.inputSnapshot, null, 2)}
              </pre>
            </div>
          </Card>

          <DistillationResultPanel
            distillation={distillation}
            hint={t("distillations.detailResultHint")}
          />
        </div>
      </div>
    </div>
  );
};
