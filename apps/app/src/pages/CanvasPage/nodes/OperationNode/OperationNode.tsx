import { Handle, Position } from "@xyflow/react";
import { Zap, CheckCircle2, XCircle, Loader2, Circle, Brain } from "lucide-react";
import { useCallback } from "react";
import { useStore } from "zustand";
import { cn } from "@repo/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { useHarnessCanvasStore, type OperationNodeData, type NodeRunStatus } from "../../_store";
import { Route } from "@/routes/canvas";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { LLM_PROVIDERS } from "@/models/tables/settings_table";
import { BestPracticeSelect } from "./BestPracticeSelect";

export interface OperationNodeProps {
  id: string;
  data: OperationNodeData;
  selected?: boolean;
}

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", label: "待运行" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    label: "运行中",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", label: "成功" },
  fail: { icon: XCircle, color: "text-red-500", label: "失败" },
};

const handleStopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

const PROVIDER_LABELS: Record<string, string> = {
  kimi: "Kimi",
  deepseek: "DeepSeek",
};

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  kimi: [
    { value: "kimi-k2-0711-preview", label: "Kimi K2 Preview" },
    { value: "kimi-for-coding", label: "Kimi for Coding" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek Chat" },
    { value: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
};

export const OperationNode = ({ id, data, selected }: OperationNodeProps) => {
  const { runStatus: nodeRunStatus, dimmed } = useNodeRunState(id);
  const { operations, bestPractices } = Route.useLoaderData();
  const store = useHarnessCanvasStore();
  const updateNodeData = useStore(store, (s) => s.updateNodeData);
  const isTestRunning = useStore(store, (s) => s.isTestRunning);
  const nodeLlmContent = useStore(store, (s) => s.nodeLlmContent);
  const setInspectingNodeId = useStore(store, (s) => s.setInspectingNodeId);

  const update = useCallback(
    (patch: Record<string, unknown>) => updateNodeData(id, patch),
    [updateNodeData, id]
  );

  const { icon: StatusIcon, color, label: statusLabel } = statusConfig[data.status ?? "idle"];

  const operation = operations.find((op) => op.id === data.operationId);

  const handleLabelChange = (v: string) => update({ label: v, operationName: v });

  const selectedProvider = data.llmProvider ?? "";
  const selectedModel = data.llmModel ?? "";

  const handleProviderChange = (value: string | null) => {
    if (!value || value === "__default__") {
      update({ llmProvider: undefined, llmModel: undefined });
    } else {
      const models = MODEL_OPTIONS[value];
      update({ llmProvider: value, llmModel: models?.[0]?.value ?? "" });
    }
  };

  const handleModelChange = (value: string | null) => {
    if (value) update({ llmModel: value });
  };

  const handleBestPracticeChange = useCallback(
    (bpId: string | undefined, bpName: string | undefined) => {
      update({ bestPracticeId: bpId, bestPracticeName: bpName });
    },
    [update]
  );

  const hasLlmContent = !!nodeLlmContent[id];
  const canInspect = isTestRunning || hasLlmContent;
  const handleCardClick = canInspect ? () => setInspectingNodeId(id) : undefined;

  return (
    <div
      className="group relative"
      style={{
        overflow: "visible",
        cursor: canInspect ? "pointer" : undefined,
      }}
      onClick={handleCardClick}
    >
      <NodeCard
        bodyClassName="space-y-2"
        description={operation?.description || "自定义操作"}
        dimmed={dimmed}
        headerRight={
          <div
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm",
              data.status === "pass" && "bg-green-50 border-green-100",
              data.status === "fail" && "bg-red-50 border-red-100",
              data.status === "running" && "bg-blue-50 border-blue-100",
              (!data.status || data.status === "idle") && "bg-white border-slate-100"
            )}
          >
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span className={cn("text-[10px] font-semibold tracking-wide", color)}>
              {statusLabel}
            </span>
          </div>
        }
        icon={Zap}
        label={data.operationName || data.label}
        runStatus={nodeRunStatus}
        selected={selected}
        theme="violet"
        onLabelChange={handleLabelChange}
      >
        {/* Config display (read-only summary) */}
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              配置
            </p>
            <div className="rounded bg-slate-50 px-2 py-1.5">
              <pre className="text-[9px] text-slate-500 overflow-hidden text-ellipsis">
                {JSON.stringify(data.config, null, 2).slice(0, 100)}
                {JSON.stringify(data.config).length > 100 ? "..." : ""}
              </pre>
            </div>
          </div>
        )}

        {/* Accepted object types */}
        {operation?.acceptedObjectTypes && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              接受的对象类型
            </p>
            <div className="flex flex-wrap gap-1">
              {operation.acceptedObjectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-600"
                >
                  {type === "file" && "文件"}
                  {type === "folder" && "文件夹"}
                  {type === "project" && "项目"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* LLM model selector */}
        <div className="space-y-1" onMouseDown={handleStopPropagation}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Brain className="mr-1 inline-block h-3 w-3" />
            模型
          </p>
          <div className="flex gap-1.5">
            <Select value={selectedProvider || "__default__"} onValueChange={handleProviderChange}>
              <SelectTrigger className="h-6 min-w-0 flex-1 px-1.5 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Provider</SelectLabel>
                  <SelectItem value="__default__">默认</SelectItem>
                  {LLM_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_LABELS[p] ?? p}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {selectedProvider && (
              <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="h-6 min-w-0 flex-1 px-1.5 text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Model</SelectLabel>
                    {(MODEL_OPTIONS[selectedProvider] ?? []).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {hasLlmContent && (
          <div className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] text-violet-600">
            <Brain className="h-3 w-3 shrink-0" />
            <span>点击查看 LLM 输出</span>
          </div>
        )}

        {/* Best Practice selector */}
        <BestPracticeSelect
          bestPractices={bestPractices}
          value={data.bestPracticeId}
          onValueChange={handleBestPracticeChange}
        />
      </NodeCard>

      {/* Target handle (input from object or previous operation) */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full border-[3px] border-white shadow-sm transition-all hover:scale-110 -left-1.5 top-1/2 -mt-1.5 bg-violet-500"
        position={Position.Left}
        type="target"
      />
      {/* Source handle (output to next operation or object) */}
      <Handle
        className="absolute h-3.5 w-3.5 rounded-full border-[3px] border-white shadow-sm transition-all hover:scale-110 -right-1.5 top-1/2 -mt-1.5 bg-violet-500"
        position={Position.Right}
        type="source"
      />
    </div>
  );
};
