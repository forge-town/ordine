import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ExecutionPortDefinition } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
export type ExecutionCanvasNodeType = Node<
  {
    label: string;
    kind: string;
    revision?: number;
    inputPorts: ExecutionPortDefinition[];
    outputPorts: ExecutionPortDefinition[];
    unresolved?: boolean;
  },
  "execution"
>;
export const ExecutionCanvasNode = ({ data, selected }: NodeProps<ExecutionCanvasNodeType>) => (
  <div
    className={cn(
      "min-w-56 rounded-lg border bg-surface p-3 shadow-soft",
      selected ? "border-primary ring-2 ring-primary/20" : "border-border",
    )}
  >
    <div className="mb-3">
      <strong className="block max-w-64 truncate text-sm">{data.label}</strong>
      <span className="text-xs text-muted-foreground">
        {data.kind}
        {data.revision !== undefined ? ` · 固定 r${data.revision}` : ""}
      </span>
    </div>
    {data.unresolved && <p className="text-xs text-destructive">修订未解析，不能绑定端口</p>}
    <div className="grid grid-cols-2 gap-5 text-xs">
      <div className="space-y-3">
        {data.inputPorts.map((port) => (
          <div key={port.id} className="relative">
            <Handle
              className="!-left-4 !bg-primary"
              id={port.id}
              position={Position.Left}
              type="target"
            />
            <div>{port.id}</div>
            <span className="text-muted-foreground">
              {port.valueType} · {port.cardinality}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-3 text-right">
        {data.outputPorts.map((port) => (
          <div key={port.id} className="relative">
            <Handle
              className="!-right-4 !bg-primary"
              id={port.id}
              position={Position.Right}
              type="source"
            />
            <div>{port.id}</div>
            <span className="text-muted-foreground">
              {port.valueType} · {port.cardinality}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
