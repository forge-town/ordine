import { Cpu } from "lucide-react";
import type { Agent } from "@repo/schemas";

export const RuntimeCell = ({ agent }: { agent: Agent }) =>
  agent.defaultRuntime ? (
    <div className="flex items-center gap-1.5 text-sm">
      <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{agent.defaultRuntime}</span>
    </div>
  ) : (
    <span className="text-sm text-muted-foreground/50">—</span>
  );
