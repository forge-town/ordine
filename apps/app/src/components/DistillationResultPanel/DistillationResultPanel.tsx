import { useTranslation } from "react-i18next";
import type { Distillation } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";

type DistillationResultPanelProps = {
  distillation?: Distillation | null;
  emptyLabel?: string;
  hint?: string;
};

export const DistillationResultPanel = ({
  distillation,
  emptyLabel,
  hint,
}: DistillationResultPanelProps) => {
  const { t } = useTranslation();
  const completedResult = distillation?.result?.type === "completed" ? distillation.result : null;
  const failedResult = distillation?.result?.type === "failed" ? distillation.result : null;

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-foreground">
        {t("distillations.resultPanelTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {hint ?? t("distillations.resultPanelHint")}
      </p>

      {distillation ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{distillation.status}</Badge>
            <Badge variant="outline">{distillation.mode}</Badge>
          </div>

          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("distillations.summaryLabel")}
            </div>
            <p className="mt-1 text-sm text-foreground">{distillation.summary || "—"}</p>
          </div>

          {completedResult ? (
            <>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.insightsLabel")}
                </div>
                <div className="mt-2 space-y-2">
                  {completedResult.insights.length > 0 ? (
                    completedResult.insights.map((insight, index) => (
                      <div
                        key={`${insight}-${index}`}
                        className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
                      >
                        {insight}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.minimalPathLabel")}
                </div>
                <div className="mt-2 space-y-2">
                  {completedResult.minimalPath.length > 0 ? (
                    completedResult.minimalPath.map((step, index) => (
                      <div
                        key={`${step}-${index}`}
                        className="rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground"
                      >
                        {index + 1}. {step}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.assetsLabel")}
                </div>
                <div className="mt-2 space-y-2">
                  {completedResult.reusableAssets.length > 0 ? (
                    completedResult.reusableAssets.map((asset, index) => (
                      <div
                        key={`${asset.title}-${index}`}
                        className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{asset.type}</Badge>
                          <div className="text-sm font-medium text-foreground">{asset.title}</div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {asset.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("distillations.nextActionsLabel")}
                </div>
                <div className="mt-2 space-y-2">
                  {completedResult.nextActions.length > 0 ? (
                    completedResult.nextActions.map((action, index) => (
                      <div
                        key={`${action}-${index}`}
                        className="rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground"
                      >
                        {action}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>
            </>
          ) : null}

          {failedResult ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
              {failedResult.error}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
          {emptyLabel ?? t("distillations.resultEmpty")}
        </div>
      )}
    </Card>
  );
};
