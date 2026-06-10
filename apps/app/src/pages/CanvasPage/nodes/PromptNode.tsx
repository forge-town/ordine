import { MessageSquareText } from "lucide-react";
import type { PromptObjectNodeData } from "@repo/schemas";
import { GNodeShell } from "./GNodeShell";
import { GNodeMetaLine } from "./NodeFields";

export interface PromptNodeProps {
  data: PromptObjectNodeData;
  id: string;
  selected?: boolean;
}

export const PromptNode = ({ data, id, selected }: PromptNodeProps) => (
  <GNodeShell
    rightHandle
    detail="Prompt input"
    icon={MessageSquareText}
    id={id}
    kind="Prompt"
    selected={selected}
    theme="sky"
    title={data.label}
  >
    <GNodeMetaLine>{data.prompt || "Empty prompt"}</GNodeMetaLine>
  </GNodeShell>
);
