import { CheckCircle2, Plus, ArrowRight } from "lucide-react";
import { ScrollArea, ScrollBar } from "@repo/ui/scroll-area";
import { NodeCard } from "./NodeCard";

type PreviewNode = {
  id: string;
  label: string;
  reason: string;
  kind: "existing" | "new";
};

type PipelinePreviewGraphProps = {
  matchedOperations: { operationId: string; operationName: string; reason: string }[];
  unmatchedSteps: { step: string; reason: string }[];
};

const buildNodes = (
  matched: PipelinePreviewGraphProps["matchedOperations"],
  unmatched: PipelinePreviewGraphProps["unmatchedSteps"],
): PreviewNode[] => {
  const existing: PreviewNode[] = matched.map((op) => ({
    id: op.operationId,
    label: op.operationName,
    reason: op.reason,
    kind: "existing",
  }));

  const fresh: PreviewNode[] = unmatched.map((s, i) => ({
    id: `new-${String(i)}`,
    label: s.step,
    reason: s.reason,
    kind: "new",
  }));

  return [...existing, ...fresh];
};

export const PipelinePreviewGraph = ({
  matchedOperations,
  unmatchedSteps,
}: PipelinePreviewGraphProps) => {
  const nodes = buildNodes(matchedOperations, unmatchedSteps);

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          existing
        </span>
        <span className="flex items-center gap-1">
          <Plus className="h-3 w-3 text-blue-600" />
          new
        </span>
      </div>

      <ScrollArea className="w-full overflow-hidden">
        <div className="flex items-center gap-2 pb-3">
          {nodes.map((node, index) => (
            <div key={node.id} className="flex items-center gap-2">
              {index > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
              <NodeCard node={node} />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
