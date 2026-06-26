import { Cpu } from "lucide-react";
import type { Agent } from "@repo/schemas";

interface RuntimeCellProps {
  agent: Agent;
}

export const RuntimeCell = ({ agent }: RuntimeCellProps) => {
  if (!agent.defaultRuntime) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{agent.defaultRuntime}</span>
    </div>
  );
};
