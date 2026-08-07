import { useEffect, useState, type ChangeEvent } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { Project } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ResourceName } from "../../../../constants";
import { useSidebarStore } from "../../../../store/sidebarStore";
import { toastStore } from "../../../../store/toastStore";
import { SectionHeader } from "../../SectionHeader";

export const ProjectSection = () => {
  const { t } = useTranslation();
  const sidebarStore = useSidebarStore();
  const currentProjectId = useStore(sidebarStore, (state) => state.currentProjectId);
  const { result: projectsResult } = useList<Project>({ resource: ResourceName.projects });
  const { mutate: updateProject } = useUpdate();
  const project =
    projectsResult.data.find((item) => item.id === currentProjectId) ?? projectsResult.data[0];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => setName(event.target.value);
  const handleDescriptionChange = (event: ChangeEvent<HTMLInputElement>) =>
    setDescription(event.target.value);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description);
  }, [project]);

  if (!project) {
    return (
      <div className="space-y-5" data-testid="settings-project">
        <SectionHeader
          description={t("settings.project.description")}
          title={t("settings.project.title")}
        />
        <p className="text-xs text-muted-foreground">{t("settings.project.empty")}</p>
      </div>
    );
  }

  const handleSave = () => {
    updateProject(
      {
        errorNotification: false,
        id: project.id,
        resource: ResourceName.projects,
        successNotification: false,
        values: { description, name: name.trim() },
      },
      {
        onError: () =>
          toastStore.getState().addToast({
            title: t("settings.project.saveFailed"),
            type: "error",
          }),
        onSuccess: () =>
          toastStore.getState().addToast({
            title: t("settings.project.saved"),
            type: "success",
          }),
      },
    );
  };

  return (
    <div className="space-y-5" data-testid="settings-project">
      <SectionHeader
        description={t("settings.project.description")}
        title={t("settings.project.title")}
      />
      <div className="space-y-1.5">
        <Label htmlFor="settings-project-name">{t("settings.project.name")}</Label>
        <Input
          data-testid="settings-project-name"
          id="settings-project-name"
          value={name}
          onChange={handleNameChange}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-project-description">
          {t("settings.project.descriptionLabel")}
        </Label>
        <Input
          data-testid="settings-project-description"
          id="settings-project-description"
          placeholder={t("settings.project.descriptionPlaceholder")}
          value={description}
          onChange={handleDescriptionChange}
        />
      </div>
      <Button
        data-testid="settings-project-save"
        disabled={!name.trim()}
        type="button"
        onClick={handleSave}
      >
        {t("settings.project.save")}
      </Button>
    </div>
  );
};
