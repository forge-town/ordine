import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDelete, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { GithubProject } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useStore } from "zustand";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { CreateProjectDialog } from "../CreateProjectDialog";
import { ProjectCard } from "../ProjectCard";
import { useProjectsPageStore } from "../_store";

const handleCreateProject = (_p: GithubProject) => {};

export const ProjectsPageContent = () => {
  const { t } = useTranslation();
  const { result: projectsResult, query: projectsQuery } = useList<GithubProject>({
    resource: ResourceName.githubProjects,
  });
  const projects = projectsResult?.data ?? [];
  const store = useProjectsPageStore();
  const search = useStore(store, (s) => s.search);
  const showCreate = useStore(store, (s) => s.showCreate);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetShowCreate = useStore(store, (s) => s.handleSetShowCreate);
  const navigate = useNavigate();
  const { mutate: deleteProjectMutate } = useDelete();

  const filtered = projects.filter(
    (p: GithubProject) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      p.owner.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = (id: string) => {
    deleteProjectMutate({ resource: ResourceName.githubProjects, id });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);
  const handleShowCreate = () => handleSetShowCreate(true);
  const handleHideCreate = () => handleSetShowCreate(false);
  const handleProjectClick = (projectId: string) => () =>
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
    });
  const handleDeleteProject = (id: string) => () => void handleDelete(id);

  if (projectsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("projects.title")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleShowCreate}>
            <Plus className="h-4 w-4" />
            {t("projects.importProject")}
          </Button>
        }
        icon={<Folder className="h-4 w-4 text-primary" />}
        title={t("projects.title")}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("common.search")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Folder className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              {search ? t("common.notFound") : t("projects.noProjects")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? t("common.search") : t("projects.connectGitHub")}
            </p>
            {!search && (
              <Button className="mt-4" onClick={handleShowCreate}>
                <Plus className="h-4 w-4" />
                {t("projects.importProject")}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={handleProjectClick(project.id)}
                onDelete={handleDeleteProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProjectDialog onClose={handleHideCreate} onCreate={handleCreateProject} />
      )}
    </div>
  );
};
