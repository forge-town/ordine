import { CirclePlus, CircleMinus, CircleCheck, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { useRuntimesPageStore } from "../_store";

interface ScanDiffModalProps {
  onConfirm: () => void;
}

export const ScanDiffModal = ({ onConfirm }: ScanDiffModalProps) => {
  const { t } = useTranslation();
  const store = useRuntimesPageStore();
  const diff = useStore(store, (s) => s.scanDiff);
  const handleScanDiffModalOpenChange = useStore(store, (s) => s.handleScanDiffModalOpenChange);

  const open = diff !== null;
  const hasChanges =
    (diff?.added.length ?? 0) + (diff?.updated.length ?? 0) + (diff?.removed.length ?? 0) > 0;
  const rows = diff
    ? [
        ...diff.added.map((runtime) => ({ kind: "added" as const, runtime })),
        ...diff.updated.map((runtime) => ({ kind: "updated" as const, runtime })),
        ...diff.removed.map((runtime) => ({ kind: "removed" as const, runtime })),
        ...diff.unchanged.map((runtime) => ({ kind: "unchanged" as const, runtime })),
      ]
    : [];

  const handleCancelButtonClick = () => handleScanDiffModalOpenChange(false);
  const handleConfirmButtonClick = () => onConfirm();

  return (
    <Dialog open={open} onOpenChange={handleScanDiffModalOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("runtimes.scanResults")}</DialogTitle>
          <DialogDescription>{t("runtimes.scanResultsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,520px)] space-y-2 overflow-y-auto py-2 pr-1">
          {rows.map(({ kind, runtime }) => {
            const connection = runtime.connection;
            const path = connection.mode === "local" ? connection.path : connection.host;
            const version = connection.mode === "local" ? connection.version : undefined;
            const Icon =
              kind === "added"
                ? CirclePlus
                : kind === "updated"
                  ? RefreshCw
                  : kind === "removed"
                    ? CircleMinus
                    : CircleCheck;
            const statusLabel = {
              added: t("runtimes.scanAdded"),
              updated: t("runtimes.scanUpdated"),
              removed: t("runtimes.scanRemoved"),
              unchanged: t("runtimes.scanUnchanged"),
            }[kind];

            return (
              <div key={runtime.id} className="rounded-lg border border-border/70 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Icon
                    className={
                      kind === "added"
                        ? "size-4 shrink-0 text-green-600"
                        : kind === "updated"
                          ? "size-4 shrink-0 text-blue-600"
                          : kind === "removed"
                            ? "size-4 shrink-0 text-red-600"
                            : "size-4 shrink-0 text-muted-foreground"
                    }
                  />
                  <span className="truncate font-medium">{runtime.name}</span>
                  {runtime.name !== runtime.type && (
                    <span className="shrink-0 text-xs text-muted-foreground">{runtime.type}</span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {statusLabel}
                  </span>
                </div>
                {path && (
                  <div className="mt-1.5 break-all font-mono text-[10.5px] leading-4 text-muted-foreground">
                    {path}
                  </div>
                )}
                {version && (
                  <div className="mt-1 line-clamp-2 whitespace-pre-line text-[10.5px] leading-4 text-muted-foreground">
                    {version}
                  </div>
                )}
              </div>
            );
          })}
          {!hasChanges && (
            <p className="text-sm text-muted-foreground">{t("runtimes.noChanges")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancelButtonClick}>
            {t("common.cancel")}
          </Button>
          {hasChanges && (
            <Button onClick={handleConfirmButtonClick}>{t("runtimes.confirmSync")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
