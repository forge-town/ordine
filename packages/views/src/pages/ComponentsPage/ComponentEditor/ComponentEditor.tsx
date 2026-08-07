import { useState, type ChangeEvent } from "react";
import { GitBranch, Network, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
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
import { Textarea } from "@repo/ui/textarea";
import type { PipelineAsset } from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { Icon } from "../../../components/primitives";
import type { ComponentCardItem } from "../ComponentCard";

export type ComponentEditorProps = {
  asset: PipelineAsset;
  item: ComponentCardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ComponentEditor = ({ asset, item, open, onOpenChange }: ComponentEditorProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(asset.description);
  const [saveError, setSaveError] = useState(false);
  const { mutateAsync: updateAsset, mutation } = useUpdate<PipelineAsset>();

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    setSaveError(false);
  };
  const handleDescriptionChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(event.target.value);
    setSaveError(false);
  };
  const handleSaveClick = async () => {
    const nextName = name.trim();
    if (!nextName) return;

    const result = await ResultAsync.fromPromise(
      updateAsset({
        resource: ResourceName.pipelineAssets,
        id: asset.id,
        values: { name: nextName, description: description.trim() },
      }),
      () => "update-failed" as const,
    );
    if (result.isErr()) {
      setSaveError(true);

      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("components.editor.title")}</DialogTitle>
          <DialogDescription>{t("components.editor.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <Icon className="mt-0.5 shrink-0" icon={GitBranch} size={12} />
          <span>{t("components.editor.usageNotice", { count: asset.totalRuns })}</span>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="component-editor-name">{t("components.editor.name")}</Label>
              <Input id="component-editor-name" value={name} onChange={handleNameChange} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="component-editor-description">
                {t("components.editor.descriptionLabel")}
              </Label>
              <Textarea
                id="component-editor-description"
                className="min-h-28 resize-y"
                value={description}
                onChange={handleDescriptionChange}
              />
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5 font-mono text-[10.5px] text-muted-foreground">
              {item.io}
            </div>
            {saveError && (
              <p className="text-xs text-destructive" role="alert">
                {t("components.editor.saveError")}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-xs font-semibold">{t("components.editor.snapshot")}</div>
                <div className="text-[10.5px] text-muted-foreground">
                  {t("components.editor.snapshotHint")}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-[10px] text-muted-foreground">
                  {t("components.editor.nodes")}
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{asset.snapshotNodes.length}</dd>
              </div>
              <div className="rounded-lg bg-muted p-2">
                <dt className="text-[10px] text-muted-foreground">
                  {t("components.editor.inputs")}
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{asset.inputSlots.length}</dd>
              </div>
            </dl>
            <div className="flex items-start gap-2 text-[10.5px] text-muted-foreground">
              <Tags className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">
                {asset.tags.join(", ") || t("components.editor.noTags")}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={!name.trim() || mutation.isPending} onClick={handleSaveClick}>
            {mutation.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
