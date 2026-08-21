import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useCreate, useList } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import {
  Check,
  ChevronDown,
  ChevronsUpDown,
  FolderKanban,
  Loader2,
  Plus,
  Workflow,
} from "lucide-react";
import type { Project } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { SidebarMenuButton } from "@repo/ui/sidebar";
import { useSidebarStore } from "../store/sidebarStore";

const PROJECT_RESOURCE = "projects";

export const ProjectSwitcher = () => {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const store = useSidebarStore();
  const currentProjectId = useStore(store, (state) => state.currentProjectId);
  const setCurrentProjectId = useStore(store, (state) => state.setCurrentProjectId);
  const syncCurrentProjectId = useStore(store, (state) => state.syncCurrentProjectId);
  const { result, query } = useList<Project>({ resource: PROJECT_RESOURCE });
  const { mutateAsync: createProject, mutation } = useCreate<Project>();
  const projects = result.data;
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const currentProjectName =
    currentProject?.name ?? t("nav.allProjects", { defaultValue: "All projects" });

  useEffect(() => {
    if (!query.isLoading && !query.isFetching) syncCurrentProjectId(projectIds);
  }, [projectIds, query.isFetching, query.isLoading, syncCurrentProjectId]);

  const handleCreateProject = async () => {
    const name = projectName.trim();
    if (!name) {
      setCreateError(t("nav.projectNameRequired", { defaultValue: "Enter a project name" }));

      return;
    }

    const createResult = await ResultAsync.fromPromise(
      createProject({
        resource: PROJECT_RESOURCE,
        values: { name, description: "" },
      }),
      () => "create-project-failed" as const,
    );
    if (createResult.isErr()) {
      setCreateError(
        t("nav.createProjectFailed", { defaultValue: "Could not create the project" }),
      );

      return;
    }

    const project = createResult.value.data as Project;
    await query.refetch();
    setCurrentProjectId(project.id);
    setCreateOpen(false);
    setProjectName("");
    setCreateError(null);
  };

  const handleNewProjectClick = () => {
    setCreateError(null);
    setCreateOpen(true);
  };
  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setProjectName("");
      setCreateError(null);
    }
  };
  const handleProjectNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProjectName(event.target.value);
    if (createError) setCreateError(null);
  };
  const handleProjectNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void handleCreateProject();
  };
  const handleCreateCancelClick = () => setCreateOpen(false);
  const handleCreateSubmitClick = () => void handleCreateProject();

  return (
    <div className="py-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t("nav.projects", { defaultValue: "Projects" })}
          render={<SidebarMenuButton className="h-9 w-full" tooltip={currentProjectName} />}
        >
          <FolderKanban />
          <span className="truncate text-left">{currentProjectName}</span>
          {query.isLoading || mutation.isPending ? (
            <Loader2 className="ml-auto animate-spin" />
          ) : (
            <ChevronDown className="ml-auto" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("nav.projects", { defaultValue: "Projects" })}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCurrentProjectId(null)}>
              <span className="truncate">
                {t("nav.allProjects", { defaultValue: "All projects" })}
              </span>
              {currentProjectId === null && <Check className="ml-auto" />}
            </DropdownMenuItem>
            {projects.map((project) => {
              const handleProjectClick = () => setCurrentProjectId(project.id);

              return (
                <DropdownMenuItem key={project.id} onClick={handleProjectClick}>
                  <span className="truncate">{project.name}</span>
                  {project.id === currentProjectId && <Check className="ml-auto" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          {projects.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem disabled={mutation.isPending} onClick={handleNewProjectClick}>
            <Plus />
            {t("nav.newProject", { defaultValue: "New project" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("nav.newProject", { defaultValue: "New project" })}</DialogTitle>
            <DialogDescription>
              {t("nav.newProjectDescription", {
                defaultValue: "Create a project to organize your pipelines.",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              aria-describedby={createError ? "project-name-error" : undefined}
              aria-invalid={createError ? true : undefined}
              aria-label={t("nav.projectName", { defaultValue: "Project name" })}
              placeholder={t("nav.projectName", { defaultValue: "Project name" })}
              value={projectName}
              onChange={handleProjectNameChange}
              onKeyDown={handleProjectNameKeyDown}
            />
            {createError && (
              <p className="text-sm text-destructive" id="project-name-error" role="alert">
                {createError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCreateCancelClick}>
              {t("common.cancel")}
            </Button>
            <Button disabled={mutation.isPending} onClick={handleCreateSubmitClick}>
              {mutation.isPending && <Loader2 className="animate-spin" />}
              {t("common.create", { defaultValue: "Create" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const DefaultUserFooter = () => (
  <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
      <Workflow className="h-3.5 w-3.5" />
    </div>
    <span className="truncate text-xs font-medium group-data-[state=collapsed]/sidebar:hidden">
      Ordine Desktop
    </span>
    <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[state=collapsed]/sidebar:hidden" />
  </div>
);
