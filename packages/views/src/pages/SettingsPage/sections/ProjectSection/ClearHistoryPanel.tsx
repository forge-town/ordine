import { useState } from "react";
import { useDataProvider } from "@refinedev/core";
import { Trash2 } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { toastStore } from "../../../../store/toastStore";

export const ClearHistoryPanel = () => {
  const { t } = useTranslation();
  const getDataProvider = useDataProvider();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const handleConfirmOpen = () => setConfirmOpen(true);
  const handleConfirmClose = () => setConfirmOpen(false);
  const handleConfirmOpenChange = (open: boolean) => setConfirmOpen(open);

  const handleClearHistory = () => {
    const dataProvider = getDataProvider();
    setClearing(true);
    void ResultAsync.fromPromise(
      dataProvider.custom!({ method: "delete", payload: {}, url: "conversations/clearAll" }),
      () => null,
    ).match(
      () => {
        setClearing(false);
        setConfirmOpen(false);
        toastStore.getState().addToast({
          title: t("settings.project.clearDone"),
          type: "success",
        });
      },
      () => {
        setClearing(false);
        toastStore.getState().addToast({
          title: t("settings.project.clearFailed"),
          type: "error",
        });
      },
    );
  };

  return (
    <div
      className="space-y-2 rounded-md border border-destructive/25 bg-destructive/[0.03] p-4"
      data-testid="settings-clear-history-panel"
    >
      <div className="text-sm font-medium text-destructive">
        {t("settings.project.clearHistory")}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("settings.project.clearHistoryHint")}
      </p>
      <Button
        data-testid="settings-clear-history"
        size="sm"
        type="button"
        variant="outline"
        onClick={handleConfirmOpen}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        {t("settings.project.clearHistory")}
      </Button>
      <Dialog open={confirmOpen} onOpenChange={handleConfirmOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.project.clearConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("settings.project.clearConfirmBody")}</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleConfirmClose}>
              {t("settings.project.clearCancel")}
            </Button>
            <Button
              data-testid="settings-clear-history-confirm"
              disabled={clearing}
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
