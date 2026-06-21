import { useState } from "react";
import { Bot, User, Cpu, AlertTriangle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { CopyButton } from "./CopyButton";

const COLLAPSE_THRESHOLD = 600;
const PREVIEW_LENGTH = 500;

type Role = "system" | "user" | "assistant" | "error";

interface MessageBubbleProps {
  role: Role;
  content: string;
  label?: string;
}

const ROLE_CONFIG: Record<Role, { icon: React.ElementType; bg: string; iconCls: string }> = {
  system: { icon: Cpu, bg: "bg-violet-500/10 border-violet-500/20", iconCls: "text-violet-500" },
  user: { icon: User, bg: "bg-blue-500/10 border-blue-500/20", iconCls: "text-blue-500" },
  assistant: {
    icon: Bot,
    bg: "bg-emerald-500/10 border-emerald-500/20",
    iconCls: "text-emerald-500",
  },
  error: { icon: AlertTriangle, bg: "bg-red-500/10 border-red-500/20", iconCls: "text-red-500" },
};

export const MessageBubble = ({ role, content, label }: MessageBubbleProps) => {
  const [collapsed, setCollapsed] = useState(content.length > COLLAPSE_THRESHOLD);
  const isLong = content.length > COLLAPSE_THRESHOLD;
  const handleToggleCollapseButtonClick = () => setCollapsed((p) => !p);

  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  const displayContent = collapsed ? content.slice(0, PREVIEW_LENGTH) + "…" : content;

  return (
    <div className={cn("rounded-lg border p-3", cfg.bg)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.iconCls)} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label ?? role}
        </span>
        <div className="ml-auto">
          <CopyButton text={content} />
        </div>
      </div>
      <pre className="text-xs text-foreground/90 font-mono whitespace-pre-wrap wrap-break-word leading-relaxed">
        {displayContent}
      </pre>
      {isLong && (
        <Button
          className="mt-1 h-5 text-[10px] px-2 text-muted-foreground"
          variant="ghost"
          onClick={handleToggleCollapseButtonClick}
        >
          {collapsed ? `Show all (${content.length} chars)` : "Collapse"}
        </Button>
      )}
    </div>
  );
};
