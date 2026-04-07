import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Search,
  FolderGit2,
  Clock,
  GitBranch,
  ExternalLink,
  X,
  Folder,
  Link2,
  Loader2,
  AlertCircle,
  Key,
  Lock,
  Globe,
} from "lucide-react";
import { Route } from "@/routes/projects.index";
import {
  createGithubProject,
  deleteGithubProject,
} from "@/services/githubProjectsService";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  parseGitHubUrl,
  fetchRepoInfo,
  type GitHubRepoInfo,
} from "@/lib/githubApi";
import { useGithubToken } from "@/hooks/useGithubToken";
import { GitHubTokenDialog } from "@/pages/CanvasPage/nodes/GitHubProjectNode/GitHubTokenDialog";

const CreateProjectDialog = ({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (p: GithubProjectEntity) => void;
}) => {
  const { token } = useGithubToken();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);

  const handleClose = onClose;
  const handleFetch = async () => {
    const parsed = parseGitHubUrl(url.trim());
    if (!parsed) {
      setError("无效的 GitHub 仓库 URL");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const info = await fetchRepoInfo(
        parsed.owner,
        parsed.repo,
        token ?? undefined,
      );
      setRepoInfo(info);
    } catch (error) {
      setError(error instanceof Error ? error.message : "获取仓库信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!repoInfo) return;
    setSaving(true);
    try {
      const project = await createGithubProject({
        data: {
          id: `proj-${Date.now()}`,
          name: repoInfo.fullName,
          description: repoInfo.description ?? "",
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          branch: repoInfo.branch,
          githubUrl: `https://github.com/${repoInfo.fullName}`,
          isPrivate: repoInfo.isPrivate ?? false,
        },
      });
      onCreate(project as GithubProjectEntity);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTokenDialog = () => setShowTokenDialog(true);
  const handleCloseTokenDialog = () => setShowTokenDialog(false);
  const handleReset = () => {
    setRepoInfo(null);
    setError(null);
  };
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleFetch();
  };
  const handleFetchClick = () => void handleFetch();
  const handleSaveClick = () => void handleSave();

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              连接 GitHub 项目
            </h2>
            <Button
              className="h-7 w-7"
              size="icon"
              variant="ghost"
              onClick={handleClose}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="p-5 space-y-4">
            {/* Token banner */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                token
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700",
              )}
            >
              <Key className="h-3.5 w-3.5 shrink-0" />
              {token ? (
                <span>已配置 GitHub Token（可访问私有仓库）</span>
              ) : (
                <span>
                  未配置 Token，仅能访问公开仓库。
                  <button
                    className="ml-1 underline underline-offset-2"
                    onClick={handleOpenTokenDialog}
                  >
                    配置 Token
                  </button>
                </span>
              )}
            </div>

            {repoInfo ? (
              /* Step 2: Confirm */
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      {repoInfo.fullName}
                    </span>
                    {repoInfo.isPrivate ? (
                      <span className="flex items-center gap-0.5 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-600">
                        <Globe className="h-2.5 w-2.5" /> Public
                      </span>
                    )}
                  </div>
                  {repoInfo.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {repoInfo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    {repoInfo.branch}
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleReset}>
                    重新输入
                  </Button>
                  <Button disabled={saving} onClick={handleSaveClick}>
                    {saving ? "保存中..." : "添加到项目库"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Step 1: URL input */
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    GitHub 仓库 URL
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-8 text-sm"
                        placeholder="https://github.com/owner/repo"
                        value={url}
                        onChange={handleUrlChange}
                        onKeyDown={handleKeyDown}
                      />
                    </div>
                    <Button
                      disabled={loading || !url.trim()}
                      size="sm"
                      onClick={handleFetchClick}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "查询"
                      )}
                    </Button>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
            )}

            {repoInfo === null && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleClose}>
                  取消
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showTokenDialog && (
        <GitHubTokenDialog
          open={showTokenDialog}
          onClose={handleCloseTokenDialog}
        />
      )}
    </>
  );
};

const handleExternalLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) =>
  e.stopPropagation();

const ProjectCard = ({
  project,
  onClick,
  onDelete,
}: {
  project: GithubProjectEntity;
  onClick: () => void;
  onDelete: () => void;
}) => {
  const handleClick = onClick;
  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete();
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
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {project.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          {project.branch}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
        </span>
      </div>
    </div>
  );
};

export const ProjectsPageContent = () => {
  const loaderProjects = Route.useLoaderData();
  const [projects, setProjects] = useState<GithubProjectEntity[]>(
    loaderProjects as GithubProjectEntity[],
  );
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.owner.toLowerCase().includes(search.toLowerCase()) ||
      p.repo.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteGithubProject({ data: { id } });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);
  const handleShowCreate = () => setShowCreate(true);
  const handleHideCreate = () => setShowCreate(false);
  const handleCreateProject = (p: GithubProjectEntity) =>
    setProjects((prev) => [p, ...prev]);
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
        <h1 className="text-base font-semibold text-foreground">项目</h1>
        <Button size="sm" onClick={handleShowCreate}>
          <Plus className="h-4 w-4" />
          连接 GitHub 项目
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="搜索项目..."
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
              {search ? "未找到匹配的项目" : "还没有项目"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {search ? "请尝试其他关键词" : "连接一个 GitHub 仓库来开始"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={handleShowCreate}>
                <Plus className="h-4 w-4" />
                连接 GitHub 项目
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
        <CreateProjectDialog
          onClose={handleHideCreate}
          onCreate={handleCreateProject}
        />
      )}
    </div>
  );
};
