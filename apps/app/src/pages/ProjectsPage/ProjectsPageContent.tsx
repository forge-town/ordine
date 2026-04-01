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
} from "lucide-react";
import { Route } from "@/routes/projects";
import {
  createGithubProject,
  deleteGithubProject,
} from "@/services/githubProjectsService";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import { cn } from "@repo/ui/lib/utils";

function CreateProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (p: GithubProjectEntity) => void;
}) {
  const [form, setForm] = useState({
    owner: "",
    repo: "",
    branch: "main",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.owner.trim() || !form.repo.trim()) return;
    setSaving(true);
    try {
      const project = await createGithubProject({
        data: {
          id: `proj-${Date.now()}`,
          name: `${form.owner}/${form.repo}`,
          description: form.description,
          owner: form.owner.trim(),
          repo: form.repo.trim(),
          branch: form.branch.trim() || "main",
          githubUrl: `https://github.com/${form.owner.trim()}/${form.repo.trim()}`,
        },
      });
      onCreate(project as GithubProjectEntity);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            连接 GitHub 项目
          </h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Owner *
              </label>
              <input
                value={form.owner}
                onChange={set("owner")}
                placeholder="e.g. vercel"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Repo *
              </label>
              <input
                value={form.repo}
                onChange={set("repo")}
                placeholder="e.g. next.js"
                required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Branch
            </label>
            <input
              value={form.branch}
              onChange={set("branch")}
              placeholder="main"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              描述 (可选)
            </label>
            <input
              value={form.description}
              onChange={set("description")}
              placeholder="项目简介"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !form.owner || !form.repo}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onClick,
  onDelete,
}: {
  project: GithubProjectEntity;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-4 hover:border-violet-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900">
          <FolderGit2 className="h-5 w-5 text-white" />
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={project.githubUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
          </a>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-red-50"
          >
            <X className="h-3.5 w-3.5 text-red-400" />
          </button>
        </div>
      </div>
      <h3 className="mt-3 text-sm font-bold text-gray-900">
        {project.owner}/{project.repo}
      </h3>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
          {project.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-400">
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
}

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">项目</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          连接 GitHub 项目
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索项目..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <Folder className="h-7 w-7 text-gray-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-gray-700">
              {search ? "未找到匹配的项目" : "还没有项目"}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {search ? "请尝试其他关键词" : "连接一个 GitHub 仓库来开始"}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className={cn(
                  "mt-4 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors",
                )}
              >
                <Plus className="h-4 w-4" />
                连接 GitHub 项目
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() =>
                  void navigate({
                    to: "/projects/$projectId",
                    params: { projectId: project.id },
                  })
                }
                onDelete={() => void handleDelete(project.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreate={(p) => setProjects((prev) => [p, ...prev])}
        />
      )}
    </div>
  );
};
