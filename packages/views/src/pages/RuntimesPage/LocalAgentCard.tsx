import { Boxes, ChevronRight, Clock, FileCode2, PlugZap, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Mono, StatusPill, Tag } from "../../components/primitives";

const RUNTIME_MONO: Record<AgentRuntimeCatalogEntry["runtime"], string> = {
  "claude-code": "CC",
  codex: "Cx",
  hermes: "He",
  mastra: "Ma",
  openclaw: "OC",
  "pi-agent": "Pi",
  opencode: "Oc",
  "kimi-code": "Ki",
  "deepseek-harness": "DS",
  "mistral-vibe": "Vi",
  "deepseek-reasonix": "Rx",
  kiro: "Kr",
  trae: "Tr",
};

interface LocalAgentCardProps {
  entry: AgentRuntimeCatalogEntry;
  onConnectionTest?: (runtimeConfigId: string) => void;
}

export const LocalAgentCard = ({ entry, onConnectionTest }: LocalAgentCardProps) => {
  const { t } = useTranslation();
  const capabilities = [
    `Stream: ${entry.compatibility.capabilities.textStreaming}`,
    ...(entry.compatibility.capabilities.thinking ? ["Thinking"] : []),
    ...(entry.compatibility.capabilities.toolEvents ? ["Tool events"] : []),
    ...(entry.compatibility.capabilities.usage ? ["Usage"] : []),
    `MCP: ${entry.compatibility.capabilities.mcpInjection}`,
    `Cancel: ${entry.compatibility.capabilities.cancellation}`,
  ];
  const status =
    entry.availability === "launchable"
      ? { label: t("localAgents.launchableStatus"), tone: "ready" as const }
      : entry.availability === "detected"
        ? { label: t("localAgents.detectedOnlyStatus"), tone: "idle" as const }
        : { label: t("localAgents.notDetectedStatus"), tone: "idle" as const };
  const supportsConnectionTest =
    entry.compatibility.supportLevel === "supported" && entry.runtimeConfigId !== null;
  const handleConnectionTestClick = () => {
    if (entry.runtimeConfigId) onConnectionTest?.(entry.runtimeConfigId);
  };

  return (
    <article className={cn(surfaceCardVariants(), "flex min-h-[210px] flex-col p-4")}>
      <div className="flex items-center gap-3">
        <Mono className={entry.path ? "bg-foreground text-primary-foreground" : undefined}>
          {RUNTIME_MONO[entry.runtime]}
        </Mono>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{entry.displayName}</span>
            <Tag>{entry.compatibility.supportLevel}</Tag>
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {entry.authenticationStatus} · models {entry.modelsSource}
          </div>
        </div>
        <StatusPill label={status.label} status={status.tone} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {capabilities.map((capability) => (
          <Tag key={capability}>{capability}</Tag>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-surface-2/70 px-3 py-2.5 ring-1 ring-border/70">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Boxes className="size-3.5" />
          <span>{t("localAgents.models")}</span>
          <span className="ml-auto normal-case tracking-normal">{entry.models.length}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {entry.models.length > 0 ? (
            entry.models.slice(0, 5).map((model) => <Tag key={model.id}>{model.displayName}</Tag>)
          ) : (
            <span className="text-[10.5px] text-muted-foreground">
              {t("localAgents.modelsNotDetected")}
            </span>
          )}
          {entry.models.length > 5 && (
            <span className="text-[10.5px] text-muted-foreground">+{entry.models.length - 5}</span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-surface-2/70 px-3 py-2.5 ring-1 ring-border/70">
        <div className="flex min-w-0 items-start gap-2">
          <FileCode2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("localAgents.executable")}
            </div>
            <div className="mt-0.5 break-all font-mono text-[10.5px] leading-4 text-foreground">
              {entry.path ?? t("localAgents.notDetectedPath")}
            </div>
          </div>
        </div>
        {entry.version && (
          <div className="line-clamp-2 whitespace-pre-line pl-[22px] text-[10.5px] leading-4 text-muted-foreground">
            {entry.version}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="size-3" />
          {entry.runtime === "codex"
            ? t("localAgents.nativeSandbox")
            : t("localAgents.bestEffortPolicy")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {entry.authenticationStatus}
        </span>
        {supportsConnectionTest && onConnectionTest && entry.runtimeConfigId && (
          <Button
            className="ml-auto h-7 gap-1 px-2 text-xs"
            size="sm"
            variant="outline"
            onClick={handleConnectionTestClick}
          >
            <PlugZap className="size-3" />
            {t("localAgents.connectionTest")}
          </Button>
        )}
        {entry.runtimeConfigId && (
          <Button
            className={cn("h-7 gap-1 px-2 text-xs", !supportsConnectionTest && "ml-auto")}
            nativeButton={false}
            render={<a href={`/runtimes/${entry.runtimeConfigId}`} />}
            size="sm"
            variant="ghost"
          >
            {t("localAgents.configure")}
            <ChevronRight className="size-3" />
          </Button>
        )}
      </div>
    </article>
  );
};
