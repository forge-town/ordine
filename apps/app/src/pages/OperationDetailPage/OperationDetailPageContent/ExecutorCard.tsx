import { useTranslation } from "react-i18next";
import { Terminal, Wand2 } from "lucide-react";
import { SectionHeader } from "../SectionHeader";
import type { ExecutorConfig } from "@repo/schemas";

const EXECUTOR_ICON: Record<string, React.ElementType> = {
  agent: Wand2,
  script: Terminal,
};

const EXECUTOR_LABEL: Record<string, string> = {
  agent: "Agent",
  script: "Script",
};

const AGENT_MODE_LABEL: Record<string, string> = {
  skill: "Skill",
  prompt: "Prompt",
};

interface ExecutorCardProps {
  executor: ExecutorConfig;
}

export const ExecutorCard = ({ executor: raw }: ExecutorCardProps) => {
  const { t } = useTranslation();
  const executor = raw;
  const Icon = EXECUTOR_ICON[executor.type] ?? Wand2;
  const modeLabel = executor.agentMode ? AGENT_MODE_LABEL[executor.agentMode] : undefined;
  const label = EXECUTOR_LABEL[executor.type] ?? executor.type;
  const displayLabel = modeLabel ? `${label} · ${modeLabel}` : label;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionHeader icon={Icon} label={`执行方式 · ${displayLabel}`} />
      <div className="mt-3 space-y-2">
        {executor.type === "agent" && executor.agentMode === "skill" && executor.skillId && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Skill ID</span>
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {executor.skillId}
            </code>
          </div>
        )}
        {executor.type === "agent" && executor.agentMode === "prompt" && executor.prompt && (
          <div>
            <span className="text-xs text-muted-foreground">{t("operations.systemPrompt")}</span>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
              {executor.prompt}
            </pre>
          </div>
        )}
        {executor.type === "script" && (
          <div className="flex items-start gap-2">
            {executor.language && (
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {executor.language}
              </span>
            )}
            {executor.command && (
              <code className="font-mono text-xs text-foreground">{executor.command}</code>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
