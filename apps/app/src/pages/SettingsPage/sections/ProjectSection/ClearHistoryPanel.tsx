import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { useAgentBarStore } from "@/pages/WorkspacePage/AgentBar/_store";

/**
 * N19-02：清除全部对话历史。与"当前选中项目"无关（删的是所有 pipeline 的
 * Agent 线程），故独立成组件，挂在 Data 节，不受 ProjectSection 的
 * "未选项目"早返回影响。
 */
export const ClearHistoryPanel = () => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const resetAgentBar = useAgentBarStore((state) => state.resetAgentBar);

  const handleClearHistory = () => {
    setClearing(true);
    void ResultAsync.fromPromise(
      dataProvider.custom!({ method: "post", payload: {}, url: "conversations/clearAll" }),
      () => null,
    ).match(
      () => {
        setClearing(false);
        setConfirmOpen(false);
        resetAgentBar();
        toastStore.getState().addToast({ title: t("settings.project.clearDone"), type: "success" });
      },
      () => {
        setClearing(false);
        toastStore.getState().addToast({ title: t("settings.project.clearFailed"), type: "error" });
      },
    );
  };

  return (
    <div
      className="space-y-2 rounded-xl border border-destructive/25 bg-destructive/[0.03] p-4"
      data-testid="settings-clear-history-panel"
    >
      <div className="text-sm font-medium text-destructive">
        {t("settings.project.clearHistory")}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("settings.project.clearHistoryHint")}
      </p>
      <Button
        data-testid="settings-clear-history"
        size="sm"
        type="button"
        variant="outline"
        onClick={() => setConfirmOpen(true)}
      >
        <Trash2 className="mr-1.5 size-3.5" />
        {t("settings.project.clearHistory")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.project.clearConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("settings.project.clearConfirmBody")}</p>
          <DialogFooter>
            <Button size="sm" type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("settings.project.clearCancel")}
            </Button>
            <Button
              data-testid="settings-clear-history-confirm"
              disabled={clearing}
              size="sm"
              type="button"
              variant="destructive"
              onClick={handleClearHistory}
            >
              {t("settings.project.clearConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
