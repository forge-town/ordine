import { Link } from "@tanstack/react-router";
import { useDelete, useList } from "@refinedev/core";
import { FlaskConical, Plus, Trash2, ExternalLink, FlaskRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import type { Distillation, DistillationStatus } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { cn } from "@repo/ui/lib/utils";

const statusVariant: Record<
  DistillationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  running: "default",
  completed: "secondary",
  failed: "destructive",
};

export const DistillationsPage = () => {
  const { t } = useTranslation();
  const { result, query } = useList<Distillation>({
    resource: ResourceName.distillations,
  });
  const { mutate: deleteDistillation } = useDelete();
  const distillations = result?.data ?? [];

  const handleDelete = (id: string) => () => {
    deleteDistillation({ resource: ResourceName.distillations, id });
  };

  if (query?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("distillations.title")} />
        <PageLoadingState variant="list" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Link className={buttonVariants({ size: "sm" })} to="/distillation-studio">
            <Plus className="h-4 w-4" />
            {t("distillations.openStudio")}
          </Link>
        }
        icon={<FlaskConical className="h-4 w-4 text-primary" />}
        title={t("distillations.title")}
      />

      <div className="flex-1 overflow-auto p-6">
        {distillations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FlaskConical className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("distillations.emptyTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">{t("distillations.emptyHint")}</p>
            <Link
              className={buttonVariants({ className: "mt-4", size: "sm" })}
              to="/distillation-studio"
            >
              <Plus className="h-4 w-4" />
              {t("distillations.openStudio")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {distillations.map((distillation) => (
              <div
                key={distillation.id}
                className="group relative rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        distillation.status === "completed"
                          ? "bg-green-500/10"
                          : distillation.status === "failed"
                            ? "bg-destructive/10"
                            : distillation.status === "running"
                              ? "bg-primary/10"
                              : "bg-muted"
                      )}
                    >
                      <FlaskRound
                        className={cn(
                          "h-4 w-4",
                          distillation.status === "completed"
                            ? "text-green-600"
                            : distillation.status === "failed"
                              ? "text-destructive"
                              : distillation.status === "running"
                                ? "text-primary"
                                : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {distillation.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      className="rounded p-1 hover:bg-accent"
                      params={{ distillationId: distillation.id }}
                      to="/distillations/$distillationId"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                    <button
                      className="rounded p-1 hover:bg-destructive/10"
                      type="button"
                      onClick={handleDelete(distillation.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>

                {distillation.summary && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {distillation.summary}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-1.5">
                  <Badge variant={statusVariant[distillation.status]}>{distillation.status}</Badge>
                  <Badge variant="outline">{distillation.mode}</Badge>
                </div>

                <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{distillation.sourceType}</span>
                  {distillation.sourceLabel && <span>{distillation.sourceLabel}</span>}
                  {distillation.meta?.createdAt && (
                    <span className="ml-auto">{distillation.meta.createdAt.toLocaleString()}</span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <Link
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                      className: "h-7 text-xs flex-1",
                    })}
                    params={{ distillationId: distillation.id }}
                    to="/distillations/$distillationId"
                  >
                    {t("distillations.viewResult")}
                  </Link>
                  <Link
                    className={buttonVariants({
                      size: "sm",
                      variant: "outline",
                      className: "h-7 text-xs flex-1",
                    })}
                    search={{
                      distillationId: distillation.id,
                      sourceType: distillation.sourceType,
                      sourceId: distillation.sourceId ?? undefined,
                      sourceLabel: distillation.sourceLabel || undefined,
                      mode: distillation.mode,
                    }}
                    to="/distillation-studio"
                  >
                    {t("distillations.openInStudio")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
