import { Cpu, Sparkles } from "lucide-react";
import { useList } from "@refinedev/core";
import type { AgentRuntimeConfig, Skill } from "@repo/schemas";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { NodeConfigSectionProps } from "./types";

const DEFAULT_EXECUTOR_VALUE = "__default__";

export const ExecutorSection = ({ node, onPatch }: NodeConfigSectionProps) => {
  const { result: runtimeResult } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const { result: skillsResult } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const runtimes = runtimeResult.data;
  const skills = skillsResult.data;
  const handleRuntimeChange = (value: string | null) => {
    if (!value) return;
    onPatch({
      agentId: undefined,
      agentRuntime: value === DEFAULT_EXECUTOR_VALUE ? undefined : value,
    });
  };
  const handleSkillChange = (value: string | null) => {
    if (!value) return;
    onPatch({
      agentId: value === DEFAULT_EXECUTOR_VALUE ? undefined : value,
      agentRuntime: undefined,
    });
  };

  if (node.data.nodeType !== "operation") {
    return (
      <section className="space-y-2 rounded-lg bg-background p-3 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[12px] font-semibold">Executor</h3>
        </div>
        <p className="text-[12px] text-muted-foreground">Executors apply to operation nodes.</p>
      </section>
    );
  }

  const operationData = node.data;
  const runtimeValue = operationData.agentRuntime ?? DEFAULT_EXECUTOR_VALUE;
  const runtimeLabel =
    runtimes.find((runtime) => runtime.type === operationData.agentRuntime)?.name ??
    "Default runtime";
  const skillValue = operationData.agentId ?? DEFAULT_EXECUTOR_VALUE;
  const skillLabel =
    skills.find((skill) => skill.id === operationData.agentId)?.label ?? "No skill override";

  return (
    <section className="space-y-3 rounded-lg bg-background p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold">Executor</h3>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`node-config-${node.id}-runtime`}>Runtime</Label>
        <Select value={runtimeValue} onValueChange={handleRuntimeChange}>
          <SelectTrigger id={`node-config-${node.id}-runtime`}>
            <SelectValue>{runtimeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_EXECUTOR_VALUE}>Default runtime</SelectItem>
            {runtimes.map((runtime) => (
              <SelectItem key={runtime.id} value={runtime.type}>
                {runtime.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`node-config-${node.id}-skill`}>Skill</Label>
        <Select value={skillValue} onValueChange={handleSkillChange}>
          <SelectTrigger id={`node-config-${node.id}-skill`}>
            <SelectValue>{skillLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_EXECUTOR_VALUE}>No skill override</SelectItem>
            {skills.map((skill) => (
              <SelectItem key={skill.id} value={skill.id}>
                {skill.label || skill.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-2 rounded-md bg-surface px-2 py-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="mt-0.5 h-3 w-3" />
        <span>Runtime and skill choices are saved on the node override.</span>
      </div>
    </section>
  );
};
