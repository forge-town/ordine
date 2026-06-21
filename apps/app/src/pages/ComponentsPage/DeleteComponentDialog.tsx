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
  usageCount: number;
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
  if (!item) return null;

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };
  const handleCancelClick = () => {
    onOpenChange(false);
  };
  const handleConfirmClick = () => {
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{item.name}"?</DialogTitle>
          <DialogDescription>
            {usageCount > 0
              ? `This component is referenced by ${usageCount} pipeline${
                  usageCount === 1 ? "" : "s"
                }. Existing pipelines keep their saved copy.`
              : "This component is not referenced by any pipeline yet."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmClick}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
