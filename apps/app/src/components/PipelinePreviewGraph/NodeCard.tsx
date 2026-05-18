import { CheckCircle2, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";

type PreviewNode = {
  id: string;
  label: string;
  reason: string;
  kind: "existing" | "new";
};

interface NodeCardProps {
  node: PreviewNode;
}

export const NodeCard = ({ node }: NodeCardProps) => {
  const isExisting = node.kind === "existing";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2",
                isExisting
                  ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
                  : "border-blue-300 border-dashed bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30",
              )}
            />
          }
        >
          {isExisting ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          ) : (
            <Plus className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          )}
          <span className="max-w-30 truncate text-sm font-medium">{node.label}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="max-w-50 text-xs">{node.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
