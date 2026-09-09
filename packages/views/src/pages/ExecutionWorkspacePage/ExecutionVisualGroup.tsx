import type { Node, NodeProps } from "@xyflow/react";
export const ExecutionVisualGroup = ({
  data,
}: NodeProps<
  Node<{
    label: string;
  }>
>) => (
  <div className="h-full w-full rounded-xl border border-dashed border-border bg-surface-2/40 p-2 text-xs text-muted-foreground">
    {data.label} · 仅视觉分组
  </div>
);
