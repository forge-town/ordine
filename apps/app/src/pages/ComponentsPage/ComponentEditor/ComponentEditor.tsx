import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import { useUpdate } from "@refinedev/core";
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
import type { PipelineAsset } from "@repo/schemas";
import { Icon } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import {
  CanvasStoreContext,
  createCanvasStore,
} from "@/pages/WorkspacePage/canvas/_store/canvasStore";
import { fromPipelineSnapshot } from "@/pages/WorkspacePage/canvas/_store/canvasTypes";
import { NodeConfig } from "@/pages/WorkspacePage/canvas/panels/NodeConfig";
import type { ComponentCardItem } from "../ComponentCard";

export type ComponentEditorProps = {
  asset?: PipelineAsset;
  item: ComponentCardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ComponentEditor = ({ asset, item, open, onOpenChange }: ComponentEditorProps) => {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const { mutate: updateAsset } = useUpdate();
  const configNodeId = asset?.snapshotNodes[0]?.id ?? null;
  const canvasStore = useMemo(() => {
    if (!asset || !configNodeId) return null;

    const snapshot = fromPipelineSnapshot({
      edges: asset.snapshotEdges,
      nodes: asset.snapshotNodes,
    });
    const store = createCanvasStore({ edges: snapshot.edges, nodes: snapshot.nodes });
    store.getState().openNodeConfig(configNodeId);

    return store;
  }, [asset, configNodeId]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };
  const handleDescriptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(event.target.value);
  };
  const handleSaveClick = () => {
    if (asset) {
      updateAsset({
        resource: ResourceName.pipelineAssets,
        id: asset.id,
        values: { name: name.trim() || asset.name, description },
      });
    }
    onOpenChange(false);
  };
  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };
  const handleCancelClick = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Component Editor</DialogTitle>
          <DialogDescription>{item.category} configuration and source snapshot.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-border">
          <div className="flex items-start gap-2">
            <Icon className="mt-0.5 shrink-0" icon={GitBranch} size={12} />
            <div>
              Used in <span className="font-medium text-foreground">{item.usageCount}</span>{" "}
              pipeline{item.usageCount === 1 ? "" : "s"}. Edits apply to new runs; existing
              pipelines keep their saved copy until re-applied.
            </div>
          </div>
        </div>

        <div className="grid min-h-0 gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="component-editor-name">Name</Label>
              <Input id="component-editor-name" value={name} onChange={handleNameChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="component-editor-description">Description</Label>
              <Input
                id="component-editor-description"
                value={description}
                onChange={handleDescriptionChange}
              />
            </div>
            <div className="rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
              {item.io}
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-xl ring-1 ring-border">
            {canvasStore && asset ? (
              <CanvasStoreContext.Provider value={canvasStore}>
                <NodeConfig pipelineId={asset.pipelineId} />
              </CanvasStoreContext.Provider>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
                No source node snapshot is available for this component yet.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancelClick}>
            Cancel
          </Button>
          <Button onClick={handleSaveClick}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
