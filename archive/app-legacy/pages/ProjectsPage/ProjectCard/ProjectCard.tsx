import { FolderGit2, GitBranch, Clock, ExternalLink, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useDelete } from "@refinedev/core";
import type { GithubProject } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

const handleExternalLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => e.stopPropagation();

export type ProjectCardProps = {
  project: GithubProject;
};

export const ProjectCard = ({ project }: ProjectCardProps) => {
  const navigate = useNavigate();
  const { mutate: deleteProject } = useDelete();

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    deleteProject({ resource: ResourceName.githubProjects, id: project.id });
  };

  const handleClick = () => {
    void navigate({ to: "/projects/$projectId", params: { projectId: project.id } });
  };

  return (
    <div
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <FolderGit2 className="h-5 w-5 text-muted-foreground" />
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent"
            href={project.githubUrl}
            rel="noreferrer"
            target="_blank"
            onClick={handleExternalLinkClick}
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10"
            onClick={handleDeleteClick}
          >
            <X className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
      <h3 className="mt-3 text-sm font-bold text-foreground">
        {project.owner}/{project.repo}
      </h3>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
      )}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          {project.branch}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {project.meta?.updatedAt?.toLocaleDateString("zh-CN") ?? "-"}
        </span>
      </div>
    </div>
  );
};
