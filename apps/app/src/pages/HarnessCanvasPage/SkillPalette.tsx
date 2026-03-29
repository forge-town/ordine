import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import type { PipelineNode, NodeType } from "./_store";
import { cn } from "@repo/ui/lib/utils";
import {
  LogIn,
  Wand2,
  ShieldCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NodeTypeItem {
  type: NodeType;
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  iconBg: string;
}

const nodeTypeItems: NodeTypeItem[] = [
  {
    type: "input",
    label: "输入节点",
    description: "pipeline 的入口，承载需求上下文",
    icon: LogIn,
    colorClass: "border-emerald-200 bg-emerald-50 hover:border-emerald-400",
    iconBg: "bg-emerald-500",
  },
  {
    type: "skill",
    label: "Skill 调用",
    description: "调用指定 skill 并定义验收条件",
    icon: Wand2,
    colorClass: "border-violet-200 bg-violet-50 hover:border-violet-400",
    iconBg: "bg-violet-500",
  },
  {
    type: "condition",
    label: "验收条件",
    description: "对输出做断言，阻止不合格产出流转",
    icon: ShieldCheck,
    colorClass: "border-amber-200 bg-amber-50 hover:border-amber-400",
    iconBg: "bg-amber-500",
  },
  {
    type: "output",
    label: "输出节点",
    description: "pipeline 出口，定义期望的最终产出",
    icon: LogOut,
    colorClass: "border-sky-200 bg-sky-50 hover:border-sky-400",
    iconBg: "bg-sky-500",
  },
];

const quickSkills: { name: string; label: string }[] = [
  { name: "page-best-practice", label: "页面结构" },
  { name: "dao-best-practice", label: "DAO 层" },
  { name: "service-best-practice", label: "Service 层" },
  { name: "store-best-practice", label: "Store 状态管理" },
  { name: "form-best-practice", label: "表单组件" },
  { name: "schema-best-practice", label: "Schema 校验" },
  { name: "barrel-export-best-practice", label: "桶导出" },
  { name: "error-handling-best-practice", label: "错误处理" },
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

    if (item.type === "input") {
      data = {
        label: "新输入",
        nodeType: "input",
        contextDescription: "",
        exampleValue: "",
      };
    } else if (item.type === "skill") {
      data = {
        label: "Skill 调用",
        nodeType: "skill",
        skillName: "page-best-practice",
        params: "{}",
        acceptanceCriteria: "",
        status: "idle",
      };
    } else if (item.type === "condition") {
      data = {
        label: "验收条件",
        nodeType: "condition",
        expression: "",
        expectedResult: "",
        status: "idle",
      };
    } else {
      data = {
        label: "输出产物",
        nodeType: "output",
        expectedSchema: "",
        notes: "",
      };
    }

    store.getState().addNode({ id, type: item.type, position: pos, data });
  };

  const handleQuickAddSkill = (skill: { name: string; label: string }) => {
    nodeCounter++;
    const id = `skill-${nodeCounter}`;
    store.getState().addNode({
      id,
      type: "skill",
      position: { x: 250 + Math.random() * 200, y: 150 + Math.random() * 200 },
      data: {
        label: skill.label,
        nodeType: "skill",
        skillName: skill.name,
        params: "{}",
        acceptanceCriteria: "",
        status: "idle",
      },
    });
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
            {/* Node type palette */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                节点类型
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

            {/* Quick-add skills */}
            <div>
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                快速添加 Skill
              </p>
              <div className="space-y-1">
                {quickSkills.map((skill) => (
                  <button
                    key={skill.name}
                    onClick={() => handleQuickAddSkill(skill)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-xs hover:bg-violet-50 transition-colors group"
                  >
                    <Wand2 className="h-3 w-3 shrink-0 text-violet-400 group-hover:text-violet-600" />
                    <span className="flex-1 text-gray-600 group-hover:text-violet-700">
                      {skill.label}
                    </span>
                    <span className="font-mono text-[9px] text-gray-400 group-hover:text-violet-400">
                      {skill.name.replace("-best-practice", "")}
                    </span>
                  </button>
                ))}
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
