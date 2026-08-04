import { LogIn, MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PromptObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeMetaLine } from "./NodeFields";

export interface PromptNodeProps {
  data: PromptObjectNodeData;
  id: string;
  selected?: boolean;
}

export const PromptNode = ({ data, id, selected }: PromptNodeProps) => {
  const { t } = useTranslation();
  const isInputPort = data.label === "Input Port";

  return (
    <GNodeShell
      rightHandle
      detail={
        isInputPort
          ? t("workspace.canvas.nodes.prompt.compoundInput")
          : t("workspace.canvas.nodes.prompt.input")
      }
      icon={isInputPort ? LogIn : MessageSquareText}
      id={id}
      kind={
        isInputPort
          ? t("workspace.canvas.nodes.kind.port")
          : t("workspace.canvas.nodes.kind.prompt")
      }
      selected={selected}
      theme={isInputPort ? "emerald" : "sky"}
      title={data.label}
    >
      <GNodeMetaLine>{data.prompt || t("workspace.canvas.nodes.prompt.empty")}</GNodeMetaLine>
    </GNodeShell>
  );
};
