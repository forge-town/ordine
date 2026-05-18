import { useStore } from "zustand";
import { AlertCircle, CheckCircle2, FileUp, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { useBestPracticesPageStore } from "../_store";

export type ImportPreviewDialogProps = {
  onConfirm: () => void;
};

export const ImportPreviewDialog = ({ onConfirm }: ImportPreviewDialogProps) => {
  const handleConfirm = () => onConfirm();
  const { t } = useTranslation();
  const store = useBestPracticesPageStore();
  const importPreview = useStore(store, (s) => s.importPreview);
  const importLoading = useStore(store, (s) => s.importLoading);
  const handleResetImport = useStore(store, (s) => s.handleResetImport);

  const open = importPreview !== null;

  const handleOpenChange = (val: boolean) => {
    if (!val) handleResetImport();
  };

  const handleCancel = () => handleResetImport();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("bestPractices.importPreview", { defaultValue: "导入预览" })}
          </DialogTitle>
          <DialogDescription>
            {t("bestPractices.importPreviewDesc", {
              defaultValue: "以下最佳实践将被导入，请确认：",
            })}
          </DialogDescription>
        </DialogHeader>

        {importPreview && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileUp className="h-4 w-4" />
                {t("bestPractices.importTotal", {
                  defaultValue: `共 ${String(importPreview.total)} 条`,
                })}
              </span>
              {importPreview.newCount > 0 && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("bestPractices.importNew", {
                    defaultValue: `${String(importPreview.newCount)} 条新增`,
                  })}
                </span>
              )}
              {importPreview.updateCount > 0 && (
                <span className="flex items-center gap-1 text-amber-600">
                  <RefreshCw className="h-4 w-4" />
                  {t("bestPractices.importUpdate", {
                    defaultValue: `${String(importPreview.updateCount)} 条覆盖`,
                  })}
                </span>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto rounded-md border border-border">
              {importPreview.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.checklistItemCount > 0 &&
                        `${String(item.checklistItemCount)} checklist items`}
                      {item.checklistItemCount > 0 && item.codeSnippetCount > 0 && " · "}
                      {item.codeSnippetCount > 0 && `${String(item.codeSnippetCount)} snippets`}
                    </span>
                  </div>
                  {item.status === "new" ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("bestPractices.statusNew", { defaultValue: "新增" })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <AlertCircle className="h-3 w-3" />
                      {t("bestPractices.statusUpdate", { defaultValue: "覆盖" })}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {importPreview.updateCount > 0 && (
              <p className="text-xs text-amber-600">
                <AlertCircle className="mr-1 inline h-3 w-3" />
                {t("bestPractices.importOverwriteWarning", {
                  defaultValue: '标记为"覆盖"的条目将替换现有数据，此操作不可撤销。',
                })}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("common.cancel", { defaultValue: "取消" })}
          </Button>
          <Button disabled={importLoading} onClick={handleConfirm}>
            {importLoading
              ? t("common.importing", { defaultValue: "导入中..." })
              : t("common.confirmImport", { defaultValue: "确认导入" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
