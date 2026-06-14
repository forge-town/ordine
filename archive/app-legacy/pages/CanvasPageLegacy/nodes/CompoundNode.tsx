import { Group } from "lucide-react";
import type { CompoundNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeMetaLine } from "./NodeFields";

export interface CompoundNodeProps {
  data: CompoundNodeData;
  id: string;
  selected?: boolean;
}

export const CompoundNode = ({ data, id, selected }: CompoundNodeProps) => (
  <GNodeShell
    leftHandle
    rightHandle
    detail={`${data.childNodeIds.length} child nodes`}
    icon={Group}
    id={id}
    kind={`${data.compoundKind ?? "custom"} compound`}
    selected={selected}
    theme="indigo"
    title={data.label}
  >
    {data.description ? <GNodeMetaLine>{data.description}</GNodeMetaLine> : null}
    <GNodeMetaLine>Double-click to open inside</GNodeMetaLine>
  </GNodeShell>
);
