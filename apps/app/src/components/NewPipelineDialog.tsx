import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCreate } from "@refinedev/core";
import { useStore } from "zustand";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui/dialog";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Input } from "@repo/ui/input";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { useSidebarStore } from "@/store/sidebarStore";

export const NewPipelineDialog = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useSidebarStore();
  const open = useStore(store, (s) => s.newPipelineOpen);
  const setOpen = useStore(store, (s) => s.setNewPipelineOpen);
  const { mutateAsync: createPipelineMutate } = useCreate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setName("");
      setDescription("");
    }
  };

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = new Date();
    const newPipeline: PipelineData = {
      id,
      name: name.trim() || t("pipelines.createNew"),
      description: description.trim(),
      tags: [],
      createdAt: now,
      updatedAt: now,
      timeoutMs: null,
      nodes: [],
      edges: [],
    };
    const result = await createPipelineMutate({
      resource: ResourceName.pipelines,
      values: newPipeline,
    });
    const saved = result.data as PipelineData;
    setOpen(false);
    setName("");
    setDescription("");
    void navigate({ to: "/canvas", search: { id: saved.id } });
  };

  const handleSubmit = () => void handleCreate();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleCancel = () => handleOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("nav.newPipeline")}</DialogTitle>
          <DialogDescription>{t("pipelines.newPipelineDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <Input placeholder={t("nav.newPipeline")} value={name} onChange={handleNameChange} />
          <Textarea
            placeholder={t("newPipelineDialog.descriptionPlaceholder")}
            rows={3}
            value={description}
            onChange={handleDescriptionChange}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{t("common.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
