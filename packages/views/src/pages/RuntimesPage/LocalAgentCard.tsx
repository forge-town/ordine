import { Boxes, ChevronRight, Clock, FileCode2, Sparkles } from "lucide-react";
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
  "deepseek-harness": {
    capabilities: ["Native profile", "Tool events", "MCP protocol"],
    label: "DeepSeek Harness",
    mono: "DS",
    models: "DeepSeek Harness profile models",
  },
  "mistral-vibe": {
    capabilities: ["ACP", "Tool events", "MCP protocol"],
    label: "Mistral Vibe",
    mono: "Vi",
    models: "Mistral Vibe ACP models",
  },
  "deepseek-reasonix": {
    capabilities: ["ACP", "Thinking", "MCP protocol"],
    label: "DeepSeek Reasonix",
    mono: "Rx",
    models: "Reasonix ACP models",
  },
  kiro: {
    capabilities: ["ACP", "Tool events", "Session resume"],
    label: "Kiro CLI",
    mono: "Kr",
    models: "Kiro ACP models",
  },
  trae: {
    capabilities: ["ACP", "Tool events", "MCP protocol"],
    label: "Trae CLI",
    mono: "Tr",
    models: "Trae ACP models",
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
  const models = connection.mode === "local" ? (connection.models ?? []) : [];
  const compatibility = runtime.compatibility;
  const capabilities = compatibility
    ? [
        `Stream: ${compatibility.capabilities.textStreaming}`,
        ...(compatibility.capabilities.thinking ? ["Thinking"] : []),
        ...(compatibility.capabilities.toolEvents ? ["Tool events"] : []),
        ...(compatibility.capabilities.usage ? ["Usage"] : []),
        `MCP: ${compatibility.capabilities.mcpInjection}`,
        `Cancel: ${compatibility.capabilities.cancellation}`,
      ]
    : meta.capabilities;

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
            {compatibility && <Tag>{compatibility.supportLevel}</Tag>}
          </div>
          <div className="truncate text-[11.5px] text-muted-foreground">{meta.models}</div>
        </div>
        <StatusPill
          label={t(detected ? "localAgents.detectedStatus" : "localAgents.configuredStatus")}
          status={detected ? "ready" : "idle"}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {capabilities.map((capability) => (
          <Tag key={capability}>{capability}</Tag>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-surface-2/70 px-3 py-2.5 ring-1 ring-border/70">
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <Boxes className="size-3.5" />
          <span>{t("localAgents.models")}</span>
          <span className="ml-auto normal-case tracking-normal">{models.length}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {models.length > 0 ? (
            models.slice(0, 5).map((model) => <Tag key={model.id}>{model.displayName}</Tag>)
          ) : (
            <span className="text-[10.5px] text-muted-foreground">
              {t("localAgents.modelsNotDetected")}
            </span>
          )}
          {models.length > 5 && (
            <span className="text-[10.5px] text-muted-foreground">+{models.length - 5}</span>
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
          {compatibility?.streamFormat ??
            (runtime.connection.mode === "local" ? "localhost" : runtime.connection.host)}
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
