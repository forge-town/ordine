import { useEffect, useState } from "react";
import { useList, useUpdate } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { Project } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { useSidebarStore } from "@/store/sidebarStore";
import { SectionHeader } from "../../SectionHeader";

/** Name and description of the project currently selected in the sidebar. */
export const ProjectSection = () => {
  const { t } = useTranslation();
  const sidebarStore = useSidebarStore();
  const currentProjectId = useStore(sidebarStore, (state) => state.currentProjectId);
  const { result: projectsResult } = useList<Project>({
    resource: ResourceName.projects,
  });
  const { mutate: updateProject } = useUpdate();
  const project =
    projectsResult?.data.find((item) => item.id === currentProjectId) ?? projectsResult?.data[0];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
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
        values: { description, name },
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
          onChange={(event) => setName(event.target.value)}
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
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <Button data-testid="settings-project-save" disabled={!name.trim()} onClick={handleSave}>
        {t("settings.project.save")}
      </Button>
    </div>
  );
};
