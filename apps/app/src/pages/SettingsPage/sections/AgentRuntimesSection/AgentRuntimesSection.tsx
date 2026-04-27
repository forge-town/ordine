import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOne, useUpdate } from "@refinedev/core";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { AgentRuntimeSchema, type AgentRuntimeConfig, type Settings } from "@repo/schemas";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Field } from "../../Field";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";

const AGENT_TYPE_OPTIONS = AgentRuntimeSchema.options;
const CONNECTION_MODES = ["local", "ssh"] as const;

const makeEmptyRuntime = (): AgentRuntimeConfig => ({
  id: crypto.randomUUID(),
  name: "",
  type: "claude-code",
  connection: { mode: "local" },
});

export const AgentRuntimesSection = () => {
  const { t } = useTranslation();
  const { result: settingsResult, query: settingsQuery } = useOne<Settings>({
    resource: "settings",
    id: "default",
  });
  const { mutateAsync: updateSettings } = useUpdate();

  const [runtimes, setRuntimes] = useState<AgentRuntimeConfig[] | null>(null);
  const [saved, setSaved] = useState(false);

  const currentRuntimes = runtimes ?? settingsResult?.agentRuntimes ?? [];

  const handleAdd = useCallback(() => {
    setRuntimes([...currentRuntimes, makeEmptyRuntime()]);
  }, [currentRuntimes]);

  const handleRemove = useCallback(
    (id: string) => {
      setRuntimes(currentRuntimes.filter((r) => r.id !== id));
    },
    [currentRuntimes]
  );

  const handleUpdate = useCallback(
    (id: string, patch: Partial<AgentRuntimeConfig>) => {
      setRuntimes(currentRuntimes.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [currentRuntimes]
  );

  const handleConnectionModeChange = useCallback(
    (id: string, mode: "local" | "ssh") => {
      setRuntimes(
        currentRuntimes.map((r) =>
          r.id === id
            ? {
                ...r,
                connection:
                  mode === "local"
                    ? { mode: "local" as const }
                    : { mode: "ssh" as const, host: "", user: "" },
              }
            : r
        )
      );
    },
    [currentRuntimes]
  );

  const handleSshFieldChange = useCallback(
    (id: string, field: string, value: string | number) => {
      setRuntimes(
        currentRuntimes.map((r) => {
          if (r.id !== id || r.connection.mode !== "ssh") return r;

          return {
            ...r,
            connection: { ...r.connection, [field]: value || undefined },
          };
        })
      );
    },
    [currentRuntimes]
  );

  const handleSave = useCallback(async () => {
    await updateSettings({
      resource: "settings",
      id: "default",
      values: { agentRuntimes: currentRuntimes },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [currentRuntimes, updateSettings]);

  if (settingsQuery.isLoading) return null;

  const s = "settings.agentRuntimesSection";

  return (
    <>
      <SectionHeader description={t(`${s}.description`)} title={t(`${s}.title`)} />

      {currentRuntimes.length === 0 && (
        <p className="text-sm text-muted-foreground">{t(`${s}.empty`)}</p>
      )}

      <div className="space-y-4">
        {currentRuntimes.map((runtime) => (
          <div key={runtime.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Field label={t(`${s}.name`)}>
                <Input
                  placeholder={t(`${s}.namePlaceholder`)}
                  value={runtime.name}
                  onChange={(e) => handleUpdate(runtime.id, { name: e.target.value })}
                />
              </Field>
              <Button
                className="ml-2 mt-5"
                size="icon"
                variant="ghost"
                onClick={() => handleRemove(runtime.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t(`${s}.type`)}>
                <Select
                  value={runtime.type}
                  onValueChange={(v) =>
                    handleUpdate(runtime.id, {
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
              </Field>

              <Field label={t(`${s}.connectionMode`)}>
                <Select
                  value={runtime.connection.mode}
                  onValueChange={(v) =>
                    handleConnectionModeChange(runtime.id, v as "local" | "ssh")
                  }
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
              </Field>
            </div>

            {runtime.connection.mode === "ssh" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t(`${s}.host`)}>
                  <Input
                    placeholder={t(`${s}.hostPlaceholder`)}
                    value={runtime.connection.host}
                    onChange={(e) => handleSshFieldChange(runtime.id, "host", e.target.value)}
                  />
                </Field>
                <Field label={t(`${s}.user`)}>
                  <Input
                    placeholder={t(`${s}.userPlaceholder`)}
                    value={runtime.connection.user}
                    onChange={(e) => handleSshFieldChange(runtime.id, "user", e.target.value)}
                  />
                </Field>
                <Field label={t(`${s}.port`)}>
                  <Input
                    placeholder="22"
                    type="number"
                    value={runtime.connection.port ?? ""}
                    onChange={(e) =>
                      handleSshFieldChange(
                        runtime.id,
                        "port",
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                  />
                </Field>
                <Field label={t(`${s}.keyPath`)}>
                  <Input
                    placeholder={t(`${s}.keyPathPlaceholder`)}
                    value={runtime.connection.keyPath ?? ""}
                    onChange={(e) => handleSshFieldChange(runtime.id, "keyPath", e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>
        ))}
      </div>

      <Button className="mt-2" size="sm" variant="outline" onClick={handleAdd}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t(`${s}.addRuntime`)}
      </Button>

      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
