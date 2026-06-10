import { ChevronRight, Clock, Sparkles } from "lucide-react";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Icon, Mono, StatusPill } from "@/components/primitives";

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
};

export type LocalAgentCardProps = {
  runtime: AgentRuntimeConfig;
  onConfigure?: (runtimeId: string) => void;
};

export const getRuntimeLabel = (runtime: AgentRuntimeConfig) =>
  runtime.name || RUNTIME_META[runtime.type]?.label || runtime.type;

export const LocalAgentCard = ({ onConfigure, runtime }: LocalAgentCardProps) => {
  const meta = RUNTIME_META[runtime.type];
  const isLocal = runtime.connection.mode === "local";
  const handleConfigureButtonClick = () => onConfigure?.(runtime.id);

  return (
    <div className="flex min-h-[190px] flex-col rounded-2xl bg-surface p-4 ring-1 ring-border shadow-soft">
      <div className="flex items-center gap-3">
        <Mono className={isLocal ? "bg-foreground text-primary-foreground" : undefined}>
          {meta?.mono ?? runtime.type.slice(0, 2).toUpperCase()}
        </Mono>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold tracking-tightish">
              {getRuntimeLabel(runtime)}
            </span>
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {runtime.connection.mode}
            </span>
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">
            {meta?.models ?? runtime.type}
          </div>
        </div>
        <StatusPill status="connected" />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {(meta?.capabilities ?? ["Runtime"]).map((capability) => (
          <span
            key={capability}
            className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted-foreground"
          >
            {capability}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon icon={Sparkles} size={11} />
          assembled per operation
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon icon={Clock} size={11} />
          {isLocal ? "localhost" : "remote"}
        </span>
        {onConfigure ? (
          <button
            className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-foreground/80 hover:text-foreground"
            type="button"
            onClick={handleConfigureButtonClick}
          >
            Configure
            <Icon icon={ChevronRight} size={12} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
