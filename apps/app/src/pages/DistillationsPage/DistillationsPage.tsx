import { Link } from "@tanstack/react-router";
import { useDelete, useList } from "@refinedev/core";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { buttonVariants } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";
import type { Distillation } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";

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
    return <PageLoadingState title={t("distillations.title")} variant="list" />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">{t("distillations.title")}</h1>
          <p className="text-xs text-muted-foreground">{t("distillations.subtitle")}</p>
        </div>
        <Link className={buttonVariants({ size: "sm" })} to="/distillations/new">
          <Plus className="h-4 w-4" />
          {t("distillations.openStudio")}
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {distillations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <FlaskConical className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-foreground">
              {t("distillations.emptyTitle")}
            </h2>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              {t("distillations.emptyHint")}
            </p>
            <Link className={buttonVariants({ className: "mt-4" })} to="/distillations/new">
              <Plus className="h-4 w-4" />
              {t("distillations.openStudio")}
            </Link>
          </div>
        ) : (
          <div className="grid max-w-5xl grid-cols-1 gap-4">
            {distillations.map((distillation) => (
              <Card key={distillation.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-foreground">
                        {distillation.title}
                      </h2>
                      <Badge variant="secondary">{distillation.status}</Badge>
                      <Badge variant="outline">{distillation.mode}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{distillation.summary || "—"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{t("distillations.sourceType")}: {distillation.sourceType}</span>
                      <span>{t("distillations.sourceId")}: {distillation.sourceId ?? "—"}</span>
                      <span>{t("distillations.sourceLabel")}: {distillation.sourceLabel || "—"}</span>
                      <span>
                        {t("common.createdAt")}: {distillation.meta?.createdAt?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                      search={{
                        sourceType: distillation.sourceType,
                        sourceId: distillation.sourceId ?? undefined,
                        sourceLabel: distillation.sourceLabel || undefined,
                        mode: distillation.mode,
                      }}
                      to="/distillations/new"
                    >
                      {t("distillations.duplicate")}
                    </Link>
                    <Button size="icon" variant="ghost" onClick={handleDelete(distillation.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
