import { useCallback, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useOne, useCustomMutation } from "@refinedev/core";
import { Pencil, RefreshCw, Server, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Separator } from "@repo/ui/separator";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { RuntimeIcon } from "../../../pages/RuntimesPage/RuntimeIcon";

const s = "runtimes";

const InfoField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-1 text-sm ${mono ? "font-mono text-xs" : "font-medium"}`}>{value}</div>
  </div>
);

export const RuntimeDetailPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runtimeId } = useParams({ strict: false }) as { runtimeId: string };
  const { result, query: runtimeQuery } = useOne<AgentRuntimeConfig>({
    resource: "agentRuntimes",
    id: runtimeId,
  });
  const { mutateAsync: syncAll } = useCustomMutation();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const runtime = result ?? null;

  const handleEdit = useCallback(() => {
    navigate({ to: "/runtimes/$runtimeId/edit", params: { runtimeId } });
  }, [navigate, runtimeId]);

  const handleDeleteBlur = useCallback(() => {
    setDeleteConfirm(false);
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);

      return;
    }
    if (!runtime) return;
    syncAll({
      url: "agentRuntimes/syncAll",
      method: "post",
      values: { runtimes: [] },
    }).then(() => {
      navigate({ to: "/runtimes" });
    });
  }, [deleteConfirm, runtime, syncAll, navigate]);

  if (runtimeQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          backTo="/runtimes"
          icon={<Server className="h-4 w-4 text-primary" />}
          title={t(`${s}.title`)}
        />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader backTo="/runtimes" title={t(`${s}.title`)} />
        <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
          <div>
            <Server className="mx-auto size-8 text-muted-foreground/25" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("common.notFound")}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => runtimeQuery.refetch()}
            >
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t(`${s}.edit`)}
            </Button>
            <Button
              size="icon"
              variant={deleteConfirm ? "destructive" : "ghost"}
              onBlur={handleDeleteBlur}
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
        backTo="/runtimes"
        icon={<RuntimeIcon className="h-4 w-4" type={runtime.type} />}
        title={runtime.name || t(`${s}.unnamed`)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <div className={cn(surfaceCardVariants(), "mx-auto max-w-3xl space-y-5 p-4 sm:p-5")}>
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoField label={t(`${s}.name`)} value={runtime.name || "—"} />
            <InfoField label={t(`${s}.type`)} value={runtime.type} />
            <InfoField label={t(`${s}.runtimeMode`)} value={runtime.connection.mode} />
            <InfoField label={t(`${s}.provider`)} value={runtime.type} />
          </div>

          <Separator />

          <InfoField mono label={t(`${s}.runtimeId`)} value={runtime.id} />

          {runtime.connection.mode === "ssh" && (
            <>
              <Separator />
              <div className="rounded-lg bg-surface-2/60 p-4 ring-1 ring-border">
                <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t(`${s}.sshConfig`)}
                </h3>
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 pt-3 sm:grid-cols-2">
                  <InfoField label={t(`${s}.host`)} value={runtime.connection.host} />
                  <InfoField label={t(`${s}.user`)} value={runtime.connection.user} />
                  {runtime.connection.port && (
                    <InfoField label={t(`${s}.port`)} value={String(runtime.connection.port)} />
                  )}
                  {runtime.connection.keyPath && (
                    <InfoField mono label={t(`${s}.keyPath`)} value={runtime.connection.keyPath} />
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t(`${s}.metadata`)}
            </h3>
            <pre className="overflow-x-auto rounded-lg bg-surface-2/60 p-4 font-mono text-xs text-muted-foreground ring-1 ring-border">
              {JSON.stringify(runtime.connection, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
