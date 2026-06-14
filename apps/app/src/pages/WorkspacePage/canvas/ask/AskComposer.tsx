import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { useCanvasStore } from "../_store/canvasStore";

/**
 * Node-anchored mini composer ("Ask"). Submits a message into the main
 * conversation flow carrying this node's structured ref — not a standalone note.
 */
export const AskComposer = () => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const askNodeId = useCanvasStore((state) => state.askNodeId);
  const nodes = useCanvasStore((state) => state.nodes);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const setAskNodeId = useCanvasStore((state) => state.setAskNodeId);
  const requestAsk = useWorkspaceStore((state) => state.requestAsk);

  const node = nodes.find((item) => item.id === askNodeId);

  if (!askNodeId || !node) {
    return null;
  }

  const buildRef = (): WorkspaceCanvasRef => ({
    baseId: node.id,
    id: drillStack.length > 0 ? [...drillStack, node.id].join("/") : node.id,
    kind: node.type ?? "node",
    label: node.data.label,
    path: [...drillStack],
    type: "node",
  });

  const handleClose = () => {
    setText("");
    setAskNodeId(null);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    requestAsk(buildRef(), trimmed);
    handleClose();
  };

  return (
    <div
      className="absolute inset-x-0 top-16 z-40 flex justify-center px-6"
      data-testid="canvas-v2-ask-composer"
    >
      <div className="w-[280px] rounded-2xl bg-surface p-2.5 shadow-float ring-1 ring-border-strong">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <span className="flex size-3.5 items-center justify-center rounded bg-foreground text-background">
            <Sparkles className="size-2" />
          </span>
          {t("workspace.canvas.ask.title", { node: node.data.label })}
        </div>
        <Textarea
          autoFocus
          className="min-h-16 resize-none text-xs"
          data-testid="ask-composer-input"
          placeholder={t("workspace.canvas.ask.placeholder")}
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
            if (event.key === "Escape") {
              handleClose();
            }
          }}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <Button
            className="h-7 flex-1 rounded-lg text-[11.5px]"
            data-testid="ask-composer-send"
            disabled={!text.trim()}
            size="sm"
            onClick={handleSubmit}
          >
            <ArrowUp className="size-3" />
            {t("workspace.canvas.ask.send")}
          </Button>
          <Button
            className="h-7 rounded-lg px-2.5 text-[11.5px]"
            data-testid="ask-composer-cancel"
            size="sm"
            variant="ghost"
            onClick={handleClose}
          >
            {t("workspace.canvas.ask.cancel")}
          </Button>
        </div>
        <div className="mt-1.5 px-0.5 text-[9.5px] leading-snug text-muted-foreground">
          {t("workspace.canvas.ask.hint")}
        </div>
      </div>
    </div>
  );
};
