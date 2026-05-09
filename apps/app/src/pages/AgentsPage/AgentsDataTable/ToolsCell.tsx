import { Wrench } from "lucide-react";
import type { Agent } from "@repo/schemas";

export const ToolsCell = ({ agent }: { agent: Agent }) =>
  agent.allowedTools.length > 0 ? (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Wrench className="h-3.5 w-3.5 shrink-0" />
      <span>{agent.allowedTools.length}</span>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground/50">—</span>
  );
