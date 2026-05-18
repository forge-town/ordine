import { Bot } from "lucide-react";
import { useOne } from "@refinedev/core";
import type { Agent } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

interface AgentNameCellProps {
  agentId: string;
}

export const AgentNameCell = ({ agentId }: AgentNameCellProps) => {
  const { result: agent } = useOne<Agent>({
    resource: ResourceName.agents,
    id: agentId,
  });

  if (!agent) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{agent.name}</div>
        {agent.description && (
          <div className="truncate text-xs text-muted-foreground">{agent.description}</div>
        )}
      </div>
    </div>
  );
};
