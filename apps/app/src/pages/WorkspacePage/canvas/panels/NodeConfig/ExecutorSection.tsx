import { Cpu, Sparkles } from "lucide-react";
import { useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig, Skill } from "@repo/schemas";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { NodeConfigSectionProps } from "./types";

const DEFAULT_EXECUTOR_VALUE = "__default__";

export const ExecutorSection = ({ node, onPatch }: NodeConfigSectionProps) => {
  const { t } = useTranslation();
  const { result: runtimeResult } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const { result: skillsResult } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const runtimes = runtimeResult.data;
  const skills = skillsResult.data;
  const handleRuntimeChange = (value: string | null) => {
    if (!value) {
      return;
    }
    onPatch({
      agentId: undefined,
      agentRuntime: value === DEFAULT_EXECUTOR_VALUE ? undefined : value,
    });
  };
  const handleSkillChange = (value: string | null) => {
    if (!value) {
      return;
    }
    onPatch({
      agentId: value === DEFAULT_EXECUTOR_VALUE ? undefined : value,
      agentRuntime: undefined,
    });
  };

  if (node.data.nodeType !== "operation") {
    return (
      <section className="space-y-2 rounded-xl bg-muted/60 p-3 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Cpu className="size-3.5 text-muted-foreground" />
          <h3 className="text-xs font-semibold">
            {t("workspace.canvas.nodeConfig.executor.title")}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("workspace.canvas.nodeConfig.executor.operationOnly")}
        </p>
      </section>
    );
  }

  const operationData = node.data;
  const runtimeValue = operationData.agentRuntime ?? DEFAULT_EXECUTOR_VALUE;
  const runtimeLabel =
    runtimes.find((runtime) => runtime.type === operationData.agentRuntime)?.name ??
    t("workspace.canvas.nodeConfig.executor.defaultRuntime");
  const skillValue = operationData.agentId ?? DEFAULT_EXECUTOR_VALUE;
  const skillLabel =
    skills.find((skill) => skill.id === operationData.agentId)?.label ??
    t("workspace.canvas.nodeConfig.executor.noSkill");

  return (
    <section className="space-y-3 rounded-xl bg-muted/60 p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Cpu className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold">{t("workspace.canvas.nodeConfig.executor.title")}</h3>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`node-config-${node.id}-runtime`}>
          {t("workspace.canvas.nodeConfig.executor.runtime")}
        </Label>
        <Select value={runtimeValue} onValueChange={handleRuntimeChange}>
          <SelectTrigger data-testid="node-config-runtime" id={`node-config-${node.id}-runtime`}>
            <SelectValue>{runtimeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_EXECUTOR_VALUE}>
              {t("workspace.canvas.nodeConfig.executor.defaultRuntime")}
            </SelectItem>
            {runtimes.map((runtime) => (
              <SelectItem key={runtime.id} value={runtime.type}>
                {runtime.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`node-config-${node.id}-skill`}>
          {t("workspace.canvas.nodeConfig.executor.skill")}
        </Label>
        <Select value={skillValue} onValueChange={handleSkillChange}>
          <SelectTrigger data-testid="node-config-skill" id={`node-config-${node.id}-skill`}>
            <SelectValue>{skillLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_EXECUTOR_VALUE}>
              {t("workspace.canvas.nodeConfig.executor.noSkill")}
            </SelectItem>
            {skills.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>
                {skill.label || skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-card px-2 py-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="mt-0.5 size-3" />
        <span>{t("workspace.canvas.nodeConfig.executor.hint")}</span>
      </div>
    </section>
  );
};
