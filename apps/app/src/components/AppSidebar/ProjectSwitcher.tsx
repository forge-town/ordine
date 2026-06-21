import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, PanelLeft, Plus } from "lucide-react";
import { useCreate, useList, type HttpError } from "@refinedev/core";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "@/components/primitives";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useSidebarStore } from "@/store/sidebarStore";
import type { CreateProjectInput, Project } from "@repo/schemas";

export type ProjectSwitcherProps = {
  onCollapse?: () => void;
};

const useOutsidePointerDown = (onOutside: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;

      onOutside();
    };

    globalThis.addEventListener("pointerdown", handlePointerDown);

    return () => globalThis.removeEventListener("pointerdown", handlePointerDown);
  }, [onOutside]);

  return ref;
};

const getProjectInitial = (projectName: string) => {
  return projectName.trim().slice(0, 1).toUpperCase() || "O";
};

export const ProjectSwitcher = ({ onCollapse }: ProjectSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const store = useSidebarStore();
  const currentProjectId = useStore(store, (s) => s.currentProjectId);
  const handleCurrentProjectChange = useStore(store, (s) => s.handleCurrentProjectChange);
  const handleCurrentProjectClear = useStore(store, (s) => s.handleCurrentProjectClear);
  const { query: projectsQuery, result: projectsResult } = useList<Project>({
    queryOptions: { retry: false },
    resource: ResourceName.projects,
  });
  const { mutateAsync: createProject } = useCreate<Project, HttpError, CreateProjectInput>();
  const projects = projectsResult.data;
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? projects[0];
  const ref = useOutsidePointerDown(() => setOpen(false));

  // Keep the persisted project id honest: sync to the first real project, and
  // drop ids that no longer exist in the database (e.g. after a data reset) —
  // otherwise pipeline creation fails on the project foreign key.
  useEffect(() => {
    if (!projectsQuery.isSuccess) return;
    if (currentProject) {
      if (currentProjectId !== currentProject.id) {
        handleCurrentProjectChange(currentProject.id);
      }

      return;
    }
    if (currentProjectId !== null) {
      handleCurrentProjectClear();
    }
  }, [
    currentProject,
    currentProjectId,
    handleCurrentProjectChange,
    handleCurrentProjectClear,
    projectsQuery.isSuccess,
  ]);

  const handleOpenToggle = () => {
    setOpen((value) => !value);
  };
  const handleCollapseClick = () => {
    onCollapse?.();
  };
  const handleProjectPointerDown = (projectId: string) => {
    handleCurrentProjectChange(projectId);
    setOpen(false);
  };
  const handleNewProjectClick = async () => {
    const created = await createProject({
      resource: ResourceName.projects,
      values: { description: "Personal workspace", name: "Untitled project" },
    });

    handleCurrentProjectChange(created.data.id);
    setOpen(false);
  };

  const projectName = currentProject?.name ?? "Ordine Studio";
  const projectDescription = currentProject?.description || "Personal workspace";

  return (
    <div className="relative px-3 pt-3">
      <div className="flex items-center gap-1.5">
        <div ref={ref} className="relative min-w-0 flex-1">
          <button
            className="flex min-w-0 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
            type="button"
            onClick={handleOpenToggle}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-[12px] font-bold text-primary-foreground">
              {getProjectInitial(projectName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-tight tracking-tightish">
                {projectName}
              </div>
              <div className="truncate text-[10.5px] text-muted-foreground">
                {projectDescription}
              </div>
            </div>
            <Icon className="shrink-0 text-muted-foreground" icon={ChevronsUpDown} size={13} />
          </button>
          {open ? (
            <div className="fade-rise absolute left-0 right-0 top-full z-40 mt-1 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong">
              <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Switch project
              </div>
              {projects.map((project) => {
                const active = project.id === currentProject?.id;
                const handleClick = () => {
                  handleProjectPointerDown(project.id);
                };

                return (
                  <button
                    key={project.id}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent/60"
                    type="button"
                    onClick={handleClick}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold">
                      {getProjectInitial(project.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium">{project.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {project.description || "Personal workspace"}
                      </div>
                    </div>
                    {active ? <Icon className="text-foreground" icon={Check} size={13} /> : null}
                  </button>
                );
              })}
              <div className="my-1 h-px bg-border" />
              <button
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
                type="button"
                onClick={handleNewProjectClick}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2">
                  <Icon icon={Plus} size={13} />
                </div>
                New project
              </button>
            </div>
          ) : null}
        </div>
        <button
          className={cn(
            "shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors",
            "hover:bg-accent/60 hover:text-foreground",
          )}
          title="Collapse sidebar"
          type="button"
          onClick={handleCollapseClick}
        >
          <Icon icon={PanelLeft} size={15} />
        </button>
      </div>
      <button
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-2.5 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        type="button"
        onClick={handleNewProjectClick}
      >
        <Icon icon={Plus} size={14} />
        New Project
      </button>
    </div>
  );
};
