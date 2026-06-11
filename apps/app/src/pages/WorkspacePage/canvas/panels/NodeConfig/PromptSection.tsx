import { MessageSquareText } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const isPromptEditable = node.data.nodeType === "prompt" || node.data.nodeType === "operation";
  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPatch(
      node.data.nodeType === "prompt"
        ? { prompt: event.target.value }
        : { loopConditionPrompt: event.target.value },
    );
  };

  return (
    <section className="space-y-2 rounded-xl bg-surface-2/60 p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <MessageSquareText className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold">{t("workspace.canvas.nodeConfig.prompt.title")}</h3>
      </div>
      {isPromptEditable ? (
        <div className="space-y-1.5">
          <Label htmlFor={`node-config-${node.id}-prompt`}>
            {node.data.nodeType === "prompt"
              ? t("workspace.canvas.nodeConfig.prompt.promptText")
              : t("workspace.canvas.nodeConfig.prompt.loopCondition")}
          </Label>
          <Textarea
            data-testid="node-config-prompt"
            id={`node-config-${node.id}-prompt`}
            rows={5}
            value={getPromptValue(node)}
            onChange={handlePromptChange}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("workspace.canvas.nodeConfig.prompt.unavailable")}
        </p>
      )}
    </section>
  );
};
