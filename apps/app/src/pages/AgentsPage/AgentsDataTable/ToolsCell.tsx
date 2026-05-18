import { Wrench } from "lucide-react";
import { useOne } from "@refinedev/core";
import type { Agent } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface ToolsCellProps {
  agentId: string;
}

export const ToolsCell = ({ agentId }: ToolsCellProps) => {
  const { result: agent } = useOne<Agent>({
    resource: ResourceName.agents,
    id: agentId,
  });

  if (!agent || agent.allowedTools.length === 0) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Wrench className="h-3.5 w-3.5 shrink-0" />
      <span>{agent.allowedTools.length}</span>
    </div>
  );
};
