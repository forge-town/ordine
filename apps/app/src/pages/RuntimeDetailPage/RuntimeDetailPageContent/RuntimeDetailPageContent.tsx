import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOne, useCustomMutation } from "@refinedev/core";
import { Trash2, Server, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Skeleton } from "@repo/ui/skeleton";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { PageHeader } from "@/components/PageHeader";
import { RuntimeIcon } from "@/pages/RuntimesPage/RuntimeIcon";
import { Route } from "@/routes/_layout/runtimes.$runtimeId.index";

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
  const { runtimeId } = Route.useParams();
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

  if (runtimeQuery.isLoading || !runtime) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          backTo="/runtimes"
          icon={<Server className="h-4 w-4 text-primary" />}
          title={t(`${s}.title`)}
        />
        <div className="flex-1 p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-lg" />
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

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5">
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
              <div className="space-y-1">
                <h3 className="text-xs font-medium text-muted-foreground">{t(`${s}.sshConfig`)}</h3>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-2">
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
            <h3 className="text-xs font-medium text-muted-foreground">{t(`${s}.metadata`)}</h3>
            <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
              {JSON.stringify(runtime.connection, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
