import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useOne, useCustomMutation } from "@refinedev/core";
import { Trash2, Server, Save, Check, Pencil, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Separator } from "@repo/ui/separator";
import { Skeleton } from "@repo/ui/skeleton";
import { AgentRuntimeSchema, type AgentRuntimeConfig } from "@repo/schemas";
import { PageHeader } from "@/components/PageHeader";
import { RuntimeIcon } from "@/pages/RuntimesPage/RuntimeIcon";
import { Route } from "@/routes/_layout/runtimes.$runtimeId";

const AGENT_TYPE_OPTIONS = AgentRuntimeSchema.options;
const CONNECTION_MODES = ["local", "ssh"] as const;

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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AgentRuntimeConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const runtime = result ?? null;

  const handleEdit = useCallback(() => {
    if (!runtime) return;
    setDraft({ ...runtime });
    setEditing(true);
  }, [runtime]);

  const handleCancel = useCallback(() => {
    setDraft(null);
    setEditing(false);
    setSaved(false);
  }, []);

  const handleUpdate = useCallback((patch: Partial<AgentRuntimeConfig>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  }, []);

  const handleConnectionModeChange = useCallback((mode: "local" | "ssh") => {
    setDraft((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        connection:
          mode === "local"
            ? { mode: "local" as const }
            : { mode: "ssh" as const, host: "", user: "" },
      };
    });
    setSaved(false);
  }, []);

  const handleSshFieldChange = useCallback((field: string, value: string | number) => {
    setDraft((prev) => {
      if (!prev || prev.connection.mode !== "ssh") return prev;

      return {
        ...prev,
        connection: { ...prev.connection, [field]: value || undefined },
      };
    });
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    await syncAll({
      url: "agentRuntimes/syncAll",
      method: "post",
      values: { runtimes: [draft] },
    });
    setSaved(true);
    setEditing(false);
    setDraft(null);
    setTimeout(() => setSaved(false), 2000);
  }, [draft, syncAll]);

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
            {editing ? (
              <>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  {t(`${s}.cancel`)}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {t(`${s}.save`)}
                </Button>
              </>
            ) : (
              <>
                {saved && (
                  <span className="flex items-center text-xs text-muted-foreground">
                    <Check className="mr-1 h-3.5 w-3.5 text-green-500" />
                    {t(`${s}.saved`)}
                  </span>
                )}
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
              </>
            )}
          </div>
        }
        backTo="/runtimes"
        icon={<RuntimeIcon className="h-4 w-4" type={runtime.type} />}
        title={runtime.name || t(`${s}.unnamed`)}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-6">
          {editing && draft ? (
            <EditView
              draft={draft}
              t={t}
              onConnectionModeChange={handleConnectionModeChange}
              onSshFieldChange={handleSshFieldChange}
              onUpdate={handleUpdate}
            />
          ) : (
            <DetailView runtime={runtime} t={t} />
          )}
        </div>
      </div>
    </div>
  );
};

const DetailView = ({
  runtime,
  t,
}: {
  runtime: AgentRuntimeConfig;
  t: (key: string) => string;
}) => (
  <>
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
  </>
);

const EditView = ({
  draft,
  t,
  onUpdate,
  onConnectionModeChange,
  onSshFieldChange,
}: {
  draft: AgentRuntimeConfig;
  t: (key: string) => string;
  onUpdate: (patch: Partial<AgentRuntimeConfig>) => void;
  onConnectionModeChange: (mode: "local" | "ssh") => void;
  onSshFieldChange: (field: string, value: string | number) => void;
}) => {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate({ name: e.target.value }),
    [onUpdate]
  );
  const handleTypeChange = useCallback(
    (v: string | null) => {
      if (v) onUpdate({ type: v as AgentRuntimeConfig["type"] });
    },
    [onUpdate]
  );
  const handleModeChange = useCallback(
    (v: string | null) => {
      if (v) onConnectionModeChange(v as "local" | "ssh");
    },
    [onConnectionModeChange]
  );
  const handleHostChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSshFieldChange("host", e.target.value),
    [onSshFieldChange]
  );
  const handleUserChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSshFieldChange("user", e.target.value),
    [onSshFieldChange]
  );
  const handlePortChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onSshFieldChange("port", e.target.value ? Number(e.target.value) : ""),
    [onSshFieldChange]
  );
  const handleKeyPathChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSshFieldChange("keyPath", e.target.value),
    [onSshFieldChange]
  );

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t(`${s}.name`)}</label>
          <Input
            placeholder={t(`${s}.namePlaceholder`)}
            value={draft.name}
            onChange={handleNameChange}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t(`${s}.type`)}</label>
            <Select value={draft.type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {AGENT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{t(`${s}.connectionMode`)}</label>
            <Select value={draft.connection.mode} onValueChange={handleModeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {CONNECTION_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`${s}.${m}`)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {draft.connection.mode === "ssh" && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground">{t(`${s}.sshConfig`)}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t(`${s}.host`)}</label>
                <Input
                  placeholder={t(`${s}.hostPlaceholder`)}
                  value={draft.connection.host}
                  onChange={handleHostChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t(`${s}.user`)}</label>
                <Input
                  placeholder={t(`${s}.userPlaceholder`)}
                  value={draft.connection.user}
                  onChange={handleUserChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t(`${s}.port`)}</label>
                <Input
                  placeholder="22"
                  type="number"
                  value={draft.connection.port ?? ""}
                  onChange={handlePortChange}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{t(`${s}.keyPath`)}</label>
                <Input
                  placeholder={t(`${s}.keyPathPlaceholder`)}
                  value={draft.connection.keyPath ?? ""}
                  onChange={handleKeyPathChange}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
