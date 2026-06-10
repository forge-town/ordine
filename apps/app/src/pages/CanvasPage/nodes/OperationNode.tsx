import { Zap } from "lucide-react";
import type { OperationNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";

export interface OperationNodeProps {
  data: OperationNodeData;
  id: string;
  selected?: boolean;
}

export const OperationNode = ({ data, id, selected }: OperationNodeProps) => (
  <GNodeShell
    leftHandle
    rightHandle
    dataStatus={data.status}
    detail={data.agentRuntime ?? data.agentId ?? data.operationName}
    icon={Zap}
    id={id}
    kind="Operation"
    selected={selected}
    theme="violet"
    title={data.label || data.operationName}
  >
    {data.loopEnabled ? <GNodeMetaLine>Loop · max {data.maxLoopCount ?? 3}</GNodeMetaLine> : null}
    {data.notes ? <GNodeMetaLine>{data.notes}</GNodeMetaLine> : null}
    <GNodeCodeLine>{data.operationName}</GNodeCodeLine>
  </GNodeShell>
);
