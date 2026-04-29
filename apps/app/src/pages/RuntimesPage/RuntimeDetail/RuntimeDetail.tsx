import { useCallback } from "react";
import { Trash2, Server, Save, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustomMutation } from "@refinedev/core";
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
import { AgentRuntimeSchema, type AgentRuntimeConfig } from "@repo/schemas";
import { useRuntimesPageStore } from "../_store";
import { useStore } from "zustand";

const AGENT_TYPE_OPTIONS = AgentRuntimeSchema.options;
const CONNECTION_MODES = ["local", "ssh"] as const;

export const RuntimeDetail = () => {
  const { t } = useTranslation();
  const s = "runtimes";
  const { mutateAsync: syncAll } = useCustomMutation();
  const store = useRuntimesPageStore();
  const runtimes = useStore(store, (state) => state.runtimes);
  const selectedId = useStore(store, (state) => state.selectedId);
  const saved = useStore(store, (state) => state.saved);
  const deleteConfirm = useStore(store, (state) => state.deleteConfirm);
  const handleUpdateRuntime = useStore(store, (state) => state.handleUpdateRuntime);
  const handleDeleteClick = useStore(store, (state) => state.handleDeleteClick);
  const handleBlurDelete = useStore(store, (state) => state.handleBlurDelete);
  const handleConnectionModeChange = useStore(store, (state) => state.handleConnectionModeChange);
  const handleSshFieldChange = useStore(store, (state) => state.handleSshFieldChange);
  const handleSaveComplete = useStore(store, (state) => state.handleSaveComplete);

  const runtime = runtimes.find((r) => r.id === selectedId);

  const handleSave = useCallback(async () => {
    await syncAll({
      url: "agentRuntimes/syncAll",
      method: "post",
      values: { runtimes },
    });
    handleSaveComplete();
  }, [runtimes, syncAll, handleSaveComplete]);

  if (!runtime) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <Server className="h-10 w-10 text-muted-foreground/30" />
        <p className="mt-3 text-sm">{t(`${s}.selectHint`)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{runtime.name || t(`${s}.unnamed`)}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={saved}
            size="sm"
            variant={saved ? "ghost" : "default"}
            onClick={handleSave}
          >
            {saved ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {t(`${s}.saved`)}
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {t(`${s}.save`)}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant={deleteConfirm ? "destructive" : "ghost"}
            onBlur={handleBlurDelete}
            onClick={handleDeleteClick}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {deleteConfirm ? t(`${s}.confirmDelete`) : t(`${s}.delete`)}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoField mono label="ID" value={runtime.id} />
            <InfoField label={t(`${s}.type`)} value={runtime.type} />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(`${s}.name`)}</label>
            <Input
              placeholder={t(`${s}.namePlaceholder`)}
              value={runtime.name}
              onChange={(e) => handleUpdateRuntime(runtime.id, { name: e.target.value })}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(`${s}.type`)}</label>
            <Select
              value={runtime.type}
              onValueChange={(v) =>
                handleUpdateRuntime(runtime.id, {
                  type: v as AgentRuntimeConfig["type"],
                })
              }
            >
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

          {/* Connection Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t(`${s}.connectionMode`)}
            </label>
            <Select
              value={runtime.connection.mode}
              onValueChange={(v) => handleConnectionModeChange(v as "local" | "ssh")}
            >
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

          {/* SSH Fields */}
          {runtime.connection.mode === "ssh" && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="text-xs font-medium text-muted-foreground">{t(`${s}.sshConfig`)}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t(`${s}.host`)}</label>
                  <Input
                    placeholder={t(`${s}.hostPlaceholder`)}
                    value={runtime.connection.host}
                    onChange={(e) => handleSshFieldChange("host", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t(`${s}.user`)}</label>
                  <Input
                    placeholder={t(`${s}.userPlaceholder`)}
                    value={runtime.connection.user}
                    onChange={(e) => handleSshFieldChange("user", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t(`${s}.port`)}</label>
                  <Input
                    placeholder="22"
                    type="number"
                    value={runtime.connection.port ?? ""}
                    onChange={(e) =>
                      handleSshFieldChange("port", e.target.value ? Number(e.target.value) : "")
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">{t(`${s}.keyPath`)}</label>
                  <Input
                    placeholder={t(`${s}.keyPathPlaceholder`)}
                    value={runtime.connection.keyPath ?? ""}
                    onChange={(e) => handleSshFieldChange("keyPath", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`mt-0.5 truncate text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
  </div>
);
