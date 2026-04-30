import { Bot, Flame, Globe, Cpu, Server } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const ICON_MAP: Record<string, { icon: typeof Bot; color: string }> = {
  "claude-code": { icon: Flame, color: "text-orange-500" },
  codex: { icon: Globe, color: "text-emerald-500" },
  openclaw: { icon: Bot, color: "text-rose-500" },
  mastra: { icon: Cpu, color: "text-violet-500" },
};

export const RuntimeIcon = ({ type, className }: { type: string; className?: string }) => {
  const config = ICON_MAP[type] ?? { icon: Server, color: "text-muted-foreground" };
  const Icon = config.icon;

  return <Icon className={cn(config.color, className)} />;
};
