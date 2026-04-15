import { Handle, Position } from "@xyflow/react";
import { Zap, CheckCircle2, XCircle, Loader2, Circle, Brain, Repeat } from "lucide-react";
import { useState } from "react";
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
import { useStore } from "zustand";
import { useHarnessCanvasStore, type OperationNodeData, type NodeRunStatus } from "../_store";
import { Route } from "@/routes/canvas";
import { NodeCard } from "../NodeCard";
import { useNodeRunState } from "../useNodeRunState";
import { LLM_PROVIDERS } from "@repo/db-schema";
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

  const { icon: StatusIcon, color, label: statusLabel } = statusConfig[data.status ?? "idle"];

  const operation = operations.find((op) => op.id === data.operationId);

  const handleLabelChange = (v: string) => updateNodeData(id, { label: v, operationName: v });

  const selectedProvider = data.llmProvider ?? "";
  const selectedModel = data.llmModel ?? "";

  const handleProviderChange = (value: string | null) => {
    if (!value || value === "__default__") {
      updateNodeData(id, { llmProvider: undefined, llmModel: undefined });
    } else {
      const models = MODEL_OPTIONS[value];
      updateNodeData(id, {
        llmProvider: value,
        llmModel: models?.[0]?.value ?? "",
      });
    }
    setProviderOpen(false);
  };

  const handleModelChange = (value: string | null) => {
    if (value) updateNodeData(id, { llmModel: value });
    setModelOpen(false);
  };

  const [providerOpen, setProviderOpen] = useState(false);
  const handleProviderOpenChange = (v: boolean) => setProviderOpen(v);
  const handleProviderToggle = () => setProviderOpen((prev) => !prev);

  const [modelOpen, setModelOpen] = useState(false);
  const handleModelOpenChange = (v: boolean) => setModelOpen(v);
  const handleModelToggle = () => setModelOpen((prev) => !prev);

  const handleBestPracticeChange = (bpId: string | undefined, bpName: string | undefined) => {
    updateNodeData(id, { bestPracticeId: bpId, bestPracticeName: bpName });
  };

  const handleLoopToggle = () => {
    updateNodeData(id, { loopEnabled: !data.loopEnabled });
  };

  const handleMaxLoopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseInt(e.target.value, 10);
    if (val >= 1 && val <= 20) updateNodeData(id, { maxLoopCount: val });
  };

  const handleConditionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { loopConditionPrompt: e.target.value });
  };

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
            <Select
              open={providerOpen}
              value={selectedProvider || "__default__"}
              onOpenChange={handleProviderOpenChange}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger
                className="h-6 min-w-0 flex-1 px-1.5 text-[10px]"
                onClick={handleProviderToggle}
              >
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
              <Select
                open={modelOpen}
                value={selectedModel}
                onOpenChange={handleModelOpenChange}
                onValueChange={handleModelChange}
              >
                <SelectTrigger
                  className="h-6 min-w-0 flex-1 px-1.5 text-[10px]"
                  onClick={handleModelToggle}
                >
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

        {/* Loop / Retry settings */}
        <div className="space-y-1.5" onMouseDown={handleStopPropagation}>
          <button
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
              data.loopEnabled
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
            type="button"
            onClick={handleLoopToggle}
          >
            <Repeat className="h-3 w-3 shrink-0" />
            {data.loopEnabled ? "循环已开启" : "开启循环"}
          </button>

          {data.loopEnabled && (
            <div className="space-y-1.5 rounded-md border border-amber-100 bg-amber-50/50 p-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-amber-700 whitespace-nowrap">
                  最大次数
                </span>
                <input
                  className="nodrag nopan h-5 w-14 rounded border border-amber-200 bg-white px-1.5 text-[10px] text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-300"
                  max={20}
                  min={1}
                  type="number"
                  value={data.maxLoopCount ?? 3}
                  onChange={handleMaxLoopChange}
                />
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-medium text-amber-700">验收条件</span>
                <textarea
                  className="nodrag nopan w-full rounded border border-amber-200 bg-white px-1.5 py-1 text-[10px] text-amber-800 placeholder:text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300"
                  placeholder="描述输出需要满足的条件..."
                  rows={2}
                  value={data.loopConditionPrompt ?? ""}
                  onChange={handleConditionChange}
                />
              </div>
            </div>
          )}
        </div>
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
