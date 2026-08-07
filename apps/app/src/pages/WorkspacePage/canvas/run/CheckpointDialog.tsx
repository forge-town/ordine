import { useState } from "react";
import { ArrowRight, Flag, Play, Square } from "lucide-react";
import { useDataProvider } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { Button } from "@repo/ui/button";
import { toastStore } from "@/store/toastStore";
import { useCanvasStore } from "../_store/canvasStore";

export const CheckpointDialog = () => {
  const { t } = useTranslation();
  const getDataProvider = useDataProvider();
  const checkpointWait = useCanvasStore((state) => state.checkpointWait);
  const latestJob = useCanvasStore((state) => state.latestJob);
  const nodes = useCanvasStore((state) => state.nodes);
  const nodeRunStatuses = useCanvasStore((state) => state.nodeRunStatuses);
  const applyJobSnapshot = useCanvasStore((state) => state.applyJobSnapshot);
  const setNodeRunStatuses = useCanvasStore((state) => state.setNodeRunStatuses);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  if (!checkpointWait) {
    return null;
  }

  const node = nodes.find((item) => item.id === checkpointWait.nodeId);
  if (node?.type === "decision") {
    return null;
  }
  const nodeLabel = node?.data.label ?? checkpointWait.nodeId;

  const handleControl = (action: "approve" | "reject") => {
    setPendingAction(action);
    const url = action === "approve" ? "jobs/resume" : "jobs/cancel";
    void ResultAsync.fromPromise(
      getDataProvider().custom!({
        method: "post",
        payload: { jobId: checkpointWait.jobId },
        url,
      }),
      () =>
        t(
          action === "approve"
            ? "workspace.canvas.run.resumeFailed"
            : "workspace.canvas.run.cancelFailed",
        ),
    ).match(
      () => {
        setPendingAction(null);
        if (action === "approve") {
          setNodeRunStatuses({ ...nodeRunStatuses, [checkpointWait.nodeId]: "running" });
        } else if (latestJob) {
          applyJobSnapshot({ ...latestJob, finishedAt: new Date(), status: "cancelled" });
        }
        toastStore.getState().addToast({
          title: t(
            action === "approve"
              ? "workspace.canvas.run.resumed"
              : "workspace.canvas.run.cancelled",
            { title: latestJob?.title ?? checkpointWait.jobId },
          ),
          type: "success",
        });
      },
      (error) => {
        setPendingAction(null);
        toastStore.getState().addToast({ title: error, type: "error" });
      },
    );
  };
  const handleApprove = () => handleControl("approve");
  const handleReject = () => handleControl("reject");

  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center p-6"
      data-testid="canvas-v2-checkpoint-dialog"
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div className="relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
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
            disabled={pendingAction !== null}
            onClick={handleApprove}
          >
            <Play className="size-3.5 fill-current" />
            {t("workspace.canvas.run.approveContinue")}
          </Button>
          <Button
            data-testid="checkpoint-reject"
            disabled={pendingAction !== null}
            variant="outline"
            onClick={handleReject}
          >
            <Square className="size-3.5" />
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
};
