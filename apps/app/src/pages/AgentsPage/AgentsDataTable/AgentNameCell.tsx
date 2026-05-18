import { Bot } from "lucide-react";
import type { Agent } from "@repo/schemas";

interface AgentNameCellProps {
  agent: Agent;
}

export const AgentNameCell = ({ agent }: AgentNameCellProps) => (
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
