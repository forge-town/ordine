import { useEffect, useMemo, useState } from "react";
import { Group } from "lucide-react";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useCanvasPageStore } from "../_store";

export const ComposeDialog = () => {
  const store = useCanvasPageStore();
  const composingNodeIds = useStore(store, (state) => state.composingNodeIds);
  const nodes = useStore(store, (state) => state.nodes);
  const setComposingNodeIds = useStore(store, (state) => state.setComposingNodeIds);
  const groupSelectedNodes = useStore(store, (state) => state.groupSelectedNodes);
  const [label, setLabel] = useState("");
  const composingNodes = useMemo(
    () => nodes.filter((node) => composingNodeIds?.includes(node.id)),
    [composingNodeIds, nodes],
  );
  const open = !!composingNodeIds && composingNodeIds.length >= 2;
  const normalizedLabel = label.trim() || `Compound ${composingNodes.length}`;

  useEffect(() => {
    if (open) {
      setLabel(`Compound ${composingNodes.length}`);
    }
  }, [composingNodes.length, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setComposingNodeIds(null);
    }
  };
  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
  };
  const handleCancelClick = () => {
    setComposingNodeIds(null);
  };
  const handleComposeClick = () => {
    if (!composingNodeIds || composingNodeIds.length < 2) {
      return;
    }

    groupSelectedNodes(composingNodeIds, normalizedLabel);
    setComposingNodeIds(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[420px]" data-testid="compose-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
              <Group className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Compose compound node</DialogTitle>
              <DialogDescription>
                {composingNodes.length} selected nodes will move inside this compound.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="compose-compound-label">Name</Label>
          <Input id="compose-compound-label" value={label} onChange={handleLabelChange} />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button type="button" onClick={handleComposeClick}>
            Compose
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
