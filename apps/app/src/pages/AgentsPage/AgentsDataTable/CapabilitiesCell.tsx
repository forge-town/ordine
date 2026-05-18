import { Sparkles } from "lucide-react";
import type { Agent } from "@repo/schemas";

export const CapabilitiesCell = ({ agent }: { agent: Agent }) =>
  agent.capabilities.length > 0 ? (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>{agent.capabilities.length}</span>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground/50">—</span>
  );
