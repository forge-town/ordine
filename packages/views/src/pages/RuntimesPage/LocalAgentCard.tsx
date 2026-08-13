import { ChevronRight, Clock, FileCode2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { Mono, StatusPill, Tag } from "../../components/primitives";

const RUNTIME_META: Record<
  AgentRuntimeConfig["type"],
  { capabilities: string[]; label: string; mono: string; models: string }
> = {
  "claude-code": {
    capabilities: ["File edit", "Shell", "Web"],
    label: "Claude Code",
    mono: "CC",
    models: "Sonnet / Opus via local CLI",
  },
  codex: {
    capabilities: ["File edit", "Shell"],
    label: "Codex",
    mono: "Cx",
    models: "OpenAI coding models",
  },
  hermes: {
    capabilities: ["Local model", "Classification"],
    label: "Hermes",
    mono: "He",
    models: "Local inference runtime",
  },
  mastra: {
    capabilities: ["Tool use", "Workflow"],
    label: "Mastra",
    mono: "Ma",
    models: "Framework runtime",
  },
  openclaw: {
    capabilities: ["Shell", "Artifacts"],
    label: "OpenClaw",
    mono: "OC",
    models: "OpenClaw runtime",
  },
  "pi-agent": {
    capabilities: ["File edit", "Shell"],
    label: "Pi Agent",
    mono: "Pi",
    models: "Multi-provider via local CLI",
  },
  opencode: {
    capabilities: ["File edit", "Shell"],
    label: "OpenCode",
    mono: "Oc",
    models: "Multi-provider via local CLI",
  },
  "kimi-code": {
    capabilities: ["File edit", "Shell"],
    label: "Kimi Code",
    mono: "Ki",
    models: "Moonshot models via local CLI",
  },
};

export const LocalAgentCard = ({ runtime }: { runtime: AgentRuntimeConfig }) => {
  const { t } = useTranslation();
  const meta = RUNTIME_META[runtime.type];
  const connection = runtime.connection;
  const isLocal = connection.mode === "local";
  const executable = connection.mode === "local" ? connection.path : connection.host;
  const version = connection.mode === "local" ? connection.version : undefined;
  const detected = connection.mode === "local" && Boolean(connection.path);

  return (
    <article className={cn(surfaceCardVariants(), "flex min-h-[190px] flex-col p-4")}>
      <div className="flex items-center gap-3">
        <Mono className={isLocal ? "bg-foreground text-primary-foreground" : undefined}>
          {meta.mono}
        </Mono>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{runtime.name || meta.label}</span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {runtime.connection.mode}
            </span>
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">{meta.models}</div>
        </div>
        <StatusPill
          label={t(detected ? "localAgents.detectedStatus" : "localAgents.configuredStatus")}
          status={detected ? "ready" : "idle"}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {meta.capabilities.map((capability) => (
          <Tag key={capability}>{capability}</Tag>
        ))}
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-surface-2/70 px-3 py-2.5 ring-1 ring-border/70">
        <div className="flex min-w-0 items-start gap-2">
          <FileCode2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("localAgents.executable")}
            </div>
            <div
              className="mt-0.5 break-all font-mono text-[10.5px] leading-4 text-foreground"
              title={executable}
            >
              {executable ?? t("localAgents.notDetectedPath")}
            </div>
          </div>
        </div>
        {version && (
          <div className="line-clamp-2 whitespace-pre-line pl-[22px] text-[10.5px] leading-4 text-muted-foreground">
            {version}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-3" />
          {t("localAgents.assembled")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {runtime.connection.mode === "local" ? "localhost" : runtime.connection.host}
        </span>
        <Button
          className="ml-auto h-7 gap-1 px-2 text-xs"
          nativeButton={false}
          render={<a href={`/runtimes/${runtime.id}`} />}
          size="sm"
          variant="ghost"
        >
          {t("localAgents.configure")}
          <ChevronRight className="size-3" />
        </Button>
      </div>
    </article>
  );
};
