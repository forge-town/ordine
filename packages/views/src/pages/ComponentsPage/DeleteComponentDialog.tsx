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
import type { ComponentCardItem } from "./ComponentCard";

export type DeleteComponentDialogProps = {
  item: ComponentCardItem | null;
  open: boolean;
  usageCount: number | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

export const DeleteComponentDialog = ({
  item,
  onConfirm,
  onOpenChange,
  open,
  usageCount,
}: DeleteComponentDialogProps) => {
  const { t } = useTranslation();
  if (!item) return null;

  const description =
    item.source === "asset" && usageCount !== null
      ? t("components.delete.assetDescription", { count: usageCount })
      : t("components.delete.description");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("components.delete.title", { name: item.name })}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
