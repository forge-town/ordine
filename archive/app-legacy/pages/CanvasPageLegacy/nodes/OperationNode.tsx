import { ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";
import type { OperationNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";
import type { NodeTheme } from "../NodeCard";

export interface OperationNodeProps {
  data: OperationNodeData;
  id: string;
  selected?: boolean;
}

interface OperationNodePresentation {
  detail: string;
  icon: LucideIcon;
  kind: string;
  theme: NodeTheme;
}

const getOperationNodePresentation = (data: OperationNodeData): OperationNodePresentation => {
  const role = data.operationName || data.label;

  if (role === "Generator") {
    return {
      detail: "Draft candidate",
      icon: Sparkles,
      kind: "Generator",
      theme: "violet",
    };
  }

  if (role === "Verifier") {
    return {
      detail: "Review criteria",
      icon: ShieldCheck,
      kind: "Verifier",
      theme: "emerald",
    };
  }

  if (role === "Quality Gate") {
    return {
      detail: "Pass / revise",
      icon: ShieldCheck,
      kind: "Gate",
      theme: "amber",
    };
  }

  return {
    detail: data.agentRuntime ?? data.agentId ?? data.operationName,
    icon: Zap,
    kind: "Operation",
    theme: "violet",
  };
};

export const OperationNode = ({ data, id, selected }: OperationNodeProps) => {
  const presentation = getOperationNodePresentation(data);

  return (
    <GNodeShell
      leftHandle
      rightHandle
      dataStatus={data.status}
      detail={presentation.detail}
      icon={presentation.icon}
      id={id}
      kind={presentation.kind}
      selected={selected}
      theme={presentation.theme}
      title={data.label || data.operationName}
    >
      {data.loopEnabled ? <GNodeMetaLine>Loop · max {data.maxLoopCount ?? 3}</GNodeMetaLine> : null}
      {data.notes ? <GNodeMetaLine>{data.notes}</GNodeMetaLine> : null}
      <GNodeCodeLine>{data.operationName}</GNodeCodeLine>
    </GNodeShell>
  );
};
