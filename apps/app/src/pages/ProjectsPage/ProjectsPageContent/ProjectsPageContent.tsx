import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Route } from "@/routes/_layout/projects.index";
import { deleteGithubProject } from "@/services/githubProjectsService";
import type { GithubProjectEntity } from "@repo/models";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { CreateProjectDialog } from "../CreateProjectDialog";
import { ProjectCard } from "../ProjectCard";

export const ProjectsPageContent = () => {
  const { t } = useTranslation();
  const loaderProjects = Route.useLoaderData();
  const [projects, setProjects] = useState<GithubProjectEntity[]>(
    loaderProjects as GithubProjectEntity[]
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.owner.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteGithubProject({ data: { id } });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);
  const handleShowCreate = () => setShowCreate(true);
  const handleHideCreate = () => setShowCreate(false);
  const handleCreateProject = (p: GithubProjectEntity) => setProjects((prev) => [p, ...prev]);
  const handleProjectClick = (projectId: string) => () =>
    void navigate({
      to: "/projects/$projectId",
      params: { projectId },
    });
  const handleDeleteProject = (id: string) => () => void handleDelete(id);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <h1 className="text-base font-semibold text-foreground">{t("projects.title")}</h1>
        <Button size="sm" onClick={handleShowCreate}>
          <Plus className="h-4 w-4" />
          {t("projects.importProject")}
        </Button>
      </div>

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
