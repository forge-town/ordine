import { ArrowRight, Flag, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { useJobControls } from "@/hooks/useJobControls";
import { toastStore } from "@/store/toastStore";
import { useCanvasStore } from "../_store/canvasStore";

export const CheckpointDialog = () => {
  const { t } = useTranslation();
  const checkpointWait = useCanvasStore((state) => state.checkpointWait);
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const nodes = useCanvasStore((state) => state.nodes);
  const setNodeRunStatuses = useCanvasStore((state) => state.setNodeRunStatuses);
  const nodeRunStatuses = useCanvasStore((state) => state.nodeRunStatuses);
  const openNodeConfig = useCanvasStore((state) => state.openNodeConfig);
  const { control, pendingKey } = useJobControls();
  const resuming = pendingKey !== null;

  if (!checkpointWait || configNodeId === checkpointWait.nodeId) {
    return null;
  }

  const node = nodes.find((item) => item.id === checkpointWait.nodeId);
  const nodeLabel = (node?.data as { label?: string } | undefined)?.label ?? checkpointWait.nodeId;

  const handleApprove = () => {
    control(
      { action: "resume", jobId: checkpointWait.jobId },
      {
        errorTitle: t("workspace.canvas.run.resumeFailed"),
        onSuccess: () => {
          setNodeRunStatuses({ ...nodeRunStatuses, [checkpointWait.nodeId]: "running" });
          toastStore.getState().addToast({
            title: t("workspace.canvas.run.resumed"),
            type: "success",
          });
        },
      },
    );
  };

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center p-6"
      data-testid="canvas-v2-checkpoint-dialog"
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div className="relative w-[420px] overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-warning/20">
            <Flag className="size-3.5 text-foreground/80" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-semibold">{t("workspace.canvas.run.checkpointTitle")}</div>
            <div className="text-[10.5px] text-muted-foreground">
              {t("workspace.canvas.run.checkpointSubtitle", { node: nodeLabel })}
            </div>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("workspace.canvas.run.checkpointBody")}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ArrowRight className="size-3" />
            {t("workspace.canvas.run.checkpointNext")}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <Button
            className="flex-1"
            data-testid="checkpoint-approve"
            disabled={resuming}
            onClick={handleApprove}
          >
            <Play className="size-3.5 fill-current" />
            {t("workspace.canvas.run.approveContinue")}
          </Button>
          <Button
            data-testid="checkpoint-edit"
            variant="outline"
            onClick={() => openNodeConfig(checkpointWait.nodeId)}
          >
            {t("workspace.canvas.run.editStep")}
          </Button>
        </div>
      </div>
    </div>
  );
};
