import { MessageSquareText } from "lucide-react";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import type { NodeConfigSectionProps } from "./types";

const getPromptValue = (node: NodeConfigSectionProps["node"]) => {
  const data = node.data;

  if (data.nodeType === "prompt") {
    return data.prompt;
  }

  if (data.nodeType === "operation") {
    return data.loopConditionPrompt ?? "";
  }

  return "";
};

export const PromptSection = ({ node, onPatch }: NodeConfigSectionProps) => {
  const isPromptEditable = node.data.nodeType === "prompt" || node.data.nodeType === "operation";
  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPatch(
      node.data.nodeType === "prompt"
        ? { prompt: event.target.value }
        : { loopConditionPrompt: event.target.value },
    );
  };

  return (
    <section className="space-y-2 rounded-lg bg-background p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold">Prompt</h3>
      </div>
      {isPromptEditable ? (
        <div className="space-y-1.5">
          <Label htmlFor={`node-config-${node.id}-prompt`}>
            {node.data.nodeType === "prompt" ? "Prompt text" : "Loop condition prompt"}
          </Label>
          <Textarea
            id={`node-config-${node.id}-prompt`}
            rows={5}
            value={getPromptValue(node)}
            onChange={handlePromptChange}
          />
        </div>
      ) : (
        <p className="text-[12px] text-muted-foreground">This node does not expose a prompt.</p>
      )}
    </section>
  );
};
