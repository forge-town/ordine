import { useStore } from "zustand";
import {
  useHarnessCanvasStore,
  type PipelineNode,
  type NodeType,
} from "../_store";
import { cn } from "@repo/ui/lib/utils";
import {
  Zap,
  FileCode,
  Folder,
  ChevronLeft,
  ChevronRight,
  FolderOutput,
  HardDrive,
} from "lucide-react";
import { SiGitHubIcon } from "../nodes/GitHubProjectNode/SiGitHubIcon";

interface NodeTypeItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
}

const objectItems: NodeTypeItem[] = [
  {
    type: "code-file",
    label: "代码文件",
    description: "指定一个代码文件作为操作对象",
    icon: FileCode,
    colorClass: "border-orange-200 bg-orange-50 hover:border-orange-400",
    iconBg: "bg-orange-500",
  },
  {
    type: "folder",
    label: "文件夹",
    description: "指定一个目录作为操作对象",
    icon: Folder,
    colorClass: "border-orange-200 bg-orange-50 hover:border-orange-400",
    iconBg: "bg-orange-400",
  },
  {
    type: "github-project",
    label: "GitHub 项目",
    description: "指定一个 GitHub 仓库作为操作对象",
    icon: SiGitHubIcon,
    colorClass: "border-orange-200 bg-orange-50 hover:border-orange-400",
    iconBg: "bg-orange-600",
  },
];

const nodeTypeItems: NodeTypeItem[] = [
  {
    type: "operation",
    label: "Operation",
    description: "执行自定义操作",
    icon: Zap,
    colorClass: "border-violet-200 bg-violet-50 hover:border-violet-400",
    iconBg: "bg-violet-500",
  },
];

const outputItems: NodeTypeItem[] = [
  {
    type: "output-project-path",
    label: "项目路径",
    description: "写入项目内的指定路径",
    icon: FolderOutput,
    colorClass: "border-teal-200 bg-teal-50 hover:border-teal-400",
    iconBg: "bg-teal-500",
  },
  {
    type: "output-local-path",
    label: "本地路径",
    description: "写入本机文件系统指定路径",
    icon: HardDrive,
    colorClass: "border-teal-200 bg-teal-50 hover:border-teal-400",
    iconBg: "bg-teal-600",
  },
];

let nodeCounter = 100;

export const SkillPalette = () => {
  const store = useHarnessCanvasStore();
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);

  const handleAddNodeType = (item: NodeTypeItem) => {
    nodeCounter++;
    const id = `${item.type}-${nodeCounter}`;
    const pos = { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 };

    let data: PipelineNode["data"];

    if (item.type === "code-file") {
      data = {
        label: "代码文件",
        nodeType: "code-file",
        filePath: "",
        language: "typescript",
        description: "",
      };
    } else if (item.type === "folder") {
      data = {
        label: "文件夹",
        nodeType: "folder",
        folderPath: "",
        description: "",
      };
    } else if (item.type === "github-project") {
      data = {
        label: "GitHub 项目",
        nodeType: "github-project",
        owner: "",
        repo: "",
        branch: "main",
        description: "",
      };
    } else if (item.type === "operation") {
      data = {
        label: "Operation",
        nodeType: "operation",
        operationId: "",
        operationName: "Operation",
        status: "idle",
        config: {},
      };
      store.getState().addNode({ id, type: "operation", position: pos, data });
      return;
    } else if (item.type === "output-project-path") {
      data = {
        label: "项目路径输出",
        nodeType: "output-project-path",
        projectId: "",
        path: "",
        description: "",
      };
    } else if (item.type === "output-local-path") {
      data = {
        label: "本地路径输出",
        nodeType: "output-local-path",
        localPath: "",
        description: "",
      };
    } else {
      return;
    }

    store.getState().addNode({ id, type: item.type, position: pos, data });
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-200",
        isSidebarOpen ? "w-64" : "w-10",
      )}
    >
      <button
        onClick={() => store.getState().toggleSidebar()}
        className="absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50"
        title={isSidebarOpen ? "收起侧栏" : "展开侧栏"}
      >
        {isSidebarOpen ? (
          <ChevronLeft className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-500" />
        )}
      </button>

      {isSidebarOpen && (
        <>
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">节点库</h2>
            <p className="mt-0.5 text-xs text-gray-400">点击添加到画布</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {/* Object nodes */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                处理对象 (Object)
              </p>
              <div className="space-y-1.5">
                {objectItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeType(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        item.colorClass,
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
                          item.iconBg,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operation nodes */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                操作节点 (Operation)
              </p>
              <div className="space-y-1.5">
                {nodeTypeItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeType(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        item.colorClass,
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
                          item.iconBg,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Output nodes */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                输出终点 (Output)
              </p>
              <div className="space-y-1.5">
                {outputItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeType(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        item.colorClass,
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded",
                          item.iconBg,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-700">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 p-3">
            <p className="text-center text-[10px] text-gray-400">
              连接节点端口以定义数据流向
            </p>
          </div>
        </>
      )}
    </div>
  );
};
