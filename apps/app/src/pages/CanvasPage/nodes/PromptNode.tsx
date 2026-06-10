import { LogIn, MessageSquareText } from "lucide-react";
import type { PromptObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeMetaLine } from "./NodeFields";

export interface PromptNodeProps {
  data: PromptObjectNodeData;
  id: string;
  selected?: boolean;
}

export const PromptNode = ({ data, id, selected }: PromptNodeProps) => {
  const isInputPort = data.label === "Input Port";

  return (
    <GNodeShell
      rightHandle
      detail={isInputPort ? "Compound input" : "Prompt input"}
      icon={isInputPort ? LogIn : MessageSquareText}
      id={id}
      kind={isInputPort ? "Port" : "Prompt"}
      selected={selected}
      theme={isInputPort ? "emerald" : "sky"}
      title={data.label}
    >
      <GNodeMetaLine>{data.prompt || "Empty prompt"}</GNodeMetaLine>
    </GNodeShell>
  );
};
