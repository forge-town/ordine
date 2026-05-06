import { CirclePlus, CircleMinus, CircleCheck } from "lucide-react";
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
  const closeScanModal = useStore(store, (s) => s.closeScanModal);

  const open = diff !== null;
  const hasChanges = (diff?.added.length ?? 0) + (diff?.removed.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeScanModal()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("runtimes.scanResults")}</DialogTitle>
          <DialogDescription>{t("runtimes.scanResultsDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {diff?.added.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm text-green-600">
              <CirclePlus className="h-4 w-4" />
              <span>{r.name}</span>
              <span className="text-xs text-muted-foreground">({r.type})</span>
            </div>
          ))}
          {diff?.removed.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm text-red-600">
              <CircleMinus className="h-4 w-4" />
              <span>{r.name}</span>
              <span className="text-xs text-muted-foreground">({r.type})</span>
            </div>
          ))}
          {diff?.unchanged.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleCheck className="h-4 w-4" />
              <span>{r.name}</span>
              <span className="text-xs text-muted-foreground">({r.type})</span>
            </div>
          ))}
          {!hasChanges && (
            <p className="text-sm text-muted-foreground">{t("runtimes.noChanges")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeScanModal}>
            {t("common.cancel")}
          </Button>
          {hasChanges && (
            <Button onClick={onConfirm}>{t("runtimes.confirmSync")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
