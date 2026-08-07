import { useState } from "react";
import { useDataProvider } from "@refinedev/core";
import { ArrowUp, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import type { ProposeActionsResponse } from "@repo/schemas";
import { toastStore } from "@/store/toastStore";
import { toPipelineSnapshot } from "../_store/canvasTypes";
import { useCanvasStore } from "../_store/canvasStore";

export type AskComposerProps = {
  pipelineId: string;
  pipelineName: string;
};

export const AskComposer = ({ pipelineId, pipelineName }: AskComposerProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const getDataProvider = useDataProvider();
  const askNodeId = useCanvasStore((state) => state.askNodeId);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const setAskNodeId = useCanvasStore((state) => state.setAskNodeId);
  const setPendingProposal = useCanvasStore((state) => state.setPendingProposal);
  const node = nodes.find((item) => item.id === askNodeId);

  if (!askNodeId || !node) {
    return null;
  }

  const referencedNodeId = drillStack.length > 0 ? [...drillStack, node.id].join("/") : node.id;
  const handleClose = () => {
    setText("");
    setAskNodeId(null);
  };
  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) {
      return;
    }
    setIsSending(true);
    void ResultAsync.fromPromise(
      getDataProvider().custom!<ProposeActionsResponse>({
        method: "post",
        payload: {
          id: pipelineId,
          message: trimmed,
          pipelineName,
          referencedNodeIds: [referencedNodeId],
          snapshot: toPipelineSnapshot({ edges, nodes }),
        },
        url: "pipelines/proposeActions",
      }),
      () => t("workspace.canvas.ask.failed"),
    ).match(
      (response) => {
        setIsSending(false);
        if (response.data.error) {
          toastStore.getState().addToast({
            description: response.data.error.detail,
            title: t("workspace.canvas.ask.failed"),
            type: "error",
          });

          return;
        }
        if (response.data.proposal) {
          setPendingProposal(response.data.proposal, response.data.diagnostics);
        }
        toastStore.getState().addToast({
          description: response.data.reply,
          title: t(
            response.data.proposal
              ? "workspace.canvas.ask.proposalReady"
              : "workspace.canvas.ask.sent",
          ),
          type: "success",
        });
        handleClose();
      },
      (error) => {
        setIsSending(false);
        toastStore.getState().addToast({ title: error, type: "error" });
      },
    );
  };
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      handleClose();
    }
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
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <Button
            className="h-7 flex-1 rounded-lg text-[11.5px]"
            data-testid="ask-composer-send"
            disabled={!text.trim() || isSending}
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
