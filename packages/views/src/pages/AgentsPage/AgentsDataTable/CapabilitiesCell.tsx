import { Sparkles } from "lucide-react";
import type { Agent } from "@repo/schemas";

interface CapabilitiesCellProps {
  agent: Agent;
}

export const CapabilitiesCell = ({ agent }: CapabilitiesCellProps) => {
  if (agent.capabilities.length === 0) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>{agent.capabilities.length}</span>
    </div>
  );
};
