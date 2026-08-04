import { ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { OperationNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeCodeLine, GNodeMetaLine } from "./NodeFields";
import type { NodeTheme } from "./support/nodeCardTheme";

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

const getOperationNodePresentation = (
  data: OperationNodeData,
  t: TFunction,
): OperationNodePresentation => {
  const role = data.operationName || data.label;

  if (role === "Generator") {
    return {
      detail: t("workspace.canvas.nodes.operation.generatorDetail"),
      icon: Sparkles,
      kind: t("workspace.canvas.nodes.operation.generatorKind"),
      theme: "violet",
    };
  }

  if (role === "Verifier") {
    return {
      detail: t("workspace.canvas.nodes.operation.verifierDetail"),
      icon: ShieldCheck,
      kind: t("workspace.canvas.nodes.operation.verifierKind"),
      theme: "emerald",
    };
  }

  if (role === "Quality Gate") {
    return {
      detail: t("workspace.canvas.nodes.operation.qualityGateDetail"),
      icon: ShieldCheck,
      kind: t("workspace.canvas.nodes.operation.qualityGateKind"),
      theme: "amber",
    };
  }

  return {
    detail: data.agentRuntime ?? data.agentId ?? data.operationName,
    icon: Zap,
    kind: t("workspace.canvas.nodes.kind.operation"),
    theme: "violet",
  };
};

export const OperationNode = ({ data, id, selected }: OperationNodeProps) => {
  const { t } = useTranslation();
  const presentation = getOperationNodePresentation(data, t);

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
      {data.loopEnabled ? (
        <GNodeMetaLine>
          {t("workspace.canvas.nodes.operation.loopMax", { count: data.maxLoopCount ?? 3 })}
        </GNodeMetaLine>
      ) : null}
      {data.notes ? <GNodeMetaLine>{data.notes}</GNodeMetaLine> : null}
      <GNodeCodeLine>{data.operationName}</GNodeCodeLine>
    </GNodeShell>
  );
};
