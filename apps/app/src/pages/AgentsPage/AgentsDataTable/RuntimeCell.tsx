import { Cpu } from "lucide-react";
import { useOne } from "@refinedev/core";
import type { Agent } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface RuntimeCellProps {
  agentId: string;
}

export const RuntimeCell = ({ agentId }: RuntimeCellProps) => {
  const { result: agent } = useOne<Agent>({
    resource: ResourceName.agents,
    id: agentId,
  });

  if (!agent || !agent.defaultRuntime) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{agent.defaultRuntime}</span>
    </div>
  );
};
