import { useState } from "react";
import {
  Plus,
  Search,
  Workflow,
  MoreHorizontal,
  Folder,
  Clock,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  pipelineCount: number;
  updatedAt: string;
}

const mockProjects: Project[] = [];

export const ProjectsPageContent = () => {
  const [search, setSearch] = useState("");

  const filtered = mockProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">项目</h1>
        <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
          <Plus className="h-4 w-4" />
          新建项目
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
              {search
                ? "请尝试其他关键词"
                : "创建第一个项目来组织你的 Pipelines"}
            </p>
            {!search && (
              <button className="mt-4 flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
                <Plus className="h-4 w-4" />
                新建项目
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((project) => (
              <div
                key={project.id}
                className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-violet-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
                    <Folder className="h-4 w-4 text-violet-600" />
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 transition-opacity">
                    <MoreHorizontal className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-gray-800">
                  {project.name}
                </h3>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                  {project.description}
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Workflow className="h-3 w-3" />
                    {project.pipelineCount} 个 Pipeline
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {project.updatedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
