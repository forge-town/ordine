import { FolderGit2, ExternalLink, GitBranch } from "lucide-react";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";

export type ProjectMetaProps = {
  project: GithubProjectEntity;
};

export const ProjectMeta = ({ project }: ProjectMetaProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <FolderGit2 className="h-6 w-6 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              {project.owner}/{project.repo}
            </h2>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href={project.githubUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{project.branch}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
