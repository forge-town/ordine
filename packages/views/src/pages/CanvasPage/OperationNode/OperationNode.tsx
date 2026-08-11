import {
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Brain,
  Repeat,
  Clock,
  UserCircle2,
  SkipForward,
  Ban,
} from "lucide-react";
import { type ElementType, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@repo/ui/select";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useCanvasPageStore, selectNodeRunState, selectNodePortCounts } from "../_store";
import type { OperationNodeData, NodeRunStatus, Operation, Agent } from "@repo/schemas";
import { useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import { NodeCard } from "../NodeCard";

export interface OperationNodeProps {
  id: string;
  data: OperationNodeData;
  selected?: boolean;
}

const statusConfig: Record<NodeRunStatus, { icon: ElementType; color: string; labelKey: string }> =
  {
    idle: {
      icon: Circle,
      color: "text-muted-foreground",
      labelKey: "nodes.operation.statusIdle",
    },
    queued: {
      icon: Clock,
      color: "text-muted-foreground",
      labelKey: "nodes.operation.statusQueued",
    },
    running: {
      icon: Loader2,
      color: "animate-spin text-blue-500 dark:text-blue-400",
      labelKey: "nodes.operation.statusRunning",
    },
    waitingForUser: {
      icon: UserCircle2,
      color: "text-amber-500 dark:text-amber-400",
      labelKey: "nodes.operation.statusWaitingForUser",
    },
    retrying: {
      icon: Repeat,
      color: "animate-spin text-blue-500 dark:text-blue-400",
      labelKey: "nodes.operation.statusRetrying",
    },
    done: {
      icon: CheckCircle2,
      color: "text-emerald-500 dark:text-emerald-400",
      labelKey: "nodes.operation.statusDone",
    },
    failed: {
      icon: XCircle,
      color: "text-red-500 dark:text-red-400",
      labelKey: "nodes.operation.statusFailed",
    },
    skipped: {
      icon: SkipForward,
      color: "text-muted-foreground",
      labelKey: "nodes.operation.statusSkipped",
    },
    cancelled: {
      icon: Ban,
      color: "text-amber-500 dark:text-amber-400",
      labelKey: "nodes.operation.statusCancelled",
    },
  };

const stopCanvasInteraction = (event: SyntheticEvent) => event.stopPropagation();

export const OperationNode = ({ id, data, selected }: OperationNodeProps) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const { runStatus: nodeRunStatus, dimmed } = useStore(store, useShallow(selectNodeRunState(id)));
  const nodeCardMode = useStore(store, (s) => s.nodeCardMode);
  const { result: operationsResult } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const { result: agentsResult } = useList<Agent>({
    resource: ResourceName.agents,
  });
  const operations = operationsResult.data;
  const agents = agentsResult.data;
  const {
    isTestRunning,
    nodeLlmContent,
    operationAgentDropdownNodeId,
    handleOperationLabelChange,
    handleOperationAgentChange,
    handleOperationLoopToggle,
    handleOperationMaxLoopChange,
    handleOperationConditionChange,
    handleOperationCardClick,
    handleOperationAgentDropdownOpenChange,
  } = useStore(
    store,
    useShallow((s) => ({
      isTestRunning: s.isTestRunning,
      nodeLlmContent: s.nodeLlmContent,
      operationAgentDropdownNodeId: s.operationAgentDropdownNodeId,
      handleOperationLabelChange: s.handleOperationLabelChange,
      handleOperationAgentChange: s.handleOperationAgentChange,
      handleOperationLoopToggle: s.handleOperationLoopToggle,
      handleOperationMaxLoopChange: s.handleOperationMaxLoopChange,
      handleOperationConditionChange: s.handleOperationConditionChange,
      handleOperationCardClick: s.handleOperationCardClick,
      handleOperationAgentDropdownOpenChange: s.handleOperationAgentDropdownOpenChange,
    })),
  );
  const {
    leftActivePortCount,
    leftActivePortMask,
    leftConnectedPortCount,
    leftConnectedPortMask,
    leftPortCount,
    rightActivePortCount,
    rightActivePortMask,
    rightConnectedPortCount,
    rightConnectedPortMask,
    rightPortCount,
  } = useStore(store, useShallow(selectNodePortCounts(id)));
  const agentOpen = operationAgentDropdownNodeId === id;

  const { icon: StatusIcon, color, labelKey } = statusConfig[data.status ?? "idle"];
  const statusLabel = t(labelKey);

  const operation = operations.find((op: Operation) => op.id === data.operationId);
  const executor = operation?.config.executor;
  const effectiveAgentMode =
    executor?.type === "agent" ? (executor.agentMode ?? "prompt") : undefined;
  const isSkillOperation = effectiveAgentMode === "skill";
  const selectableAgents = isSkillOperation
    ? agents.filter((agent) => agent.defaultRuntime !== "hermes")
    : agents;

  const selectedAgentId = data.agentId ?? "";
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const isAgentIncompatible =
    isSkillOperation && !!selectedAgent && selectedAgent.defaultRuntime === "hermes";
  const selectedAgentLabel = isAgentIncompatible
    ? `${selectedAgent.name} (${t("nodes.operation.agentIncompatible")})`
    : selectedAgentId
      ? (selectedAgent?.name ?? selectedAgentId)
      : t("nodes.operation.defaultAgent");

  const hasLlmContent = !!nodeLlmContent[id];
  const canInspect = isTestRunning || hasLlmContent;
  const objectTypeLabels: Record<string, string> = {
    file: t("nodes.operation.objectTypes.file"),
    folder: t("nodes.operation.objectTypes.folder"),
    project: t("nodes.operation.objectTypes.project"),
  };
  const canvasInteractionHandlers = {
    onPointerDown: stopCanvasInteraction,
    onMouseDown: stopCanvasInteraction,
    onClick: stopCanvasInteraction,
    onKeyDown: stopCanvasInteraction,
  };
  const handleCardClick = () => {
    handleOperationCardClick(id);
  };
  const handleLabelChange = (value: string) => {
    handleOperationLabelChange(id, value);
  };
  const handleAgentDropdownChange = (open: boolean) => {
    handleOperationAgentDropdownOpenChange(id, open);
  };
  const handleAgentValueChange = (value: string | null) => {
    handleOperationAgentChange(id, value);
  };
  const handleLoopButtonClick = (event: SyntheticEvent) => {
    stopCanvasInteraction(event);
    handleOperationLoopToggle(id);
  };

  return (
    <div
      className={cn("group relative w-fit overflow-visible", canInspect && "cursor-pointer")}
      onClick={handleCardClick}
    >
      <NodeCard
        leftHandle
        rightHandle
        bodyClassName="space-y-2"
        compact={nodeCardMode === "compact"}
        description={operation?.description || t("nodes.operation.customDescription")}
        dimmed={dimmed}
        headerRight={
          <div
            className={cn(
              "flex min-w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 shadow-sm",
              data.status === "done" && "border-emerald-500/20 bg-emerald-500/10",
              data.status === "failed" && "border-red-500/20 bg-red-500/10",
              data.status === "running" && "border-blue-500/20 bg-blue-500/10",
              data.status === "retrying" && "border-blue-500/20 bg-blue-500/10",
              data.status === "waitingForUser" && "border-amber-500/20 bg-amber-500/10",
              data.status === "skipped" && "border-border bg-surface-2",
              data.status === "cancelled" && "border-amber-500/20 bg-amber-500/10",
              (!data.status || data.status === "idle" || data.status === "queued") &&
                "border-border bg-surface-2",
            )}
          >
            <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
            <span className={cn("text-[10px] font-semibold tracking-wide", color)}>
              {statusLabel}
            </span>
          </div>
        }
        icon={Zap}
        label={data.label || data.operationName}
        leftActivePortCount={leftActivePortCount}
        leftActivePortMask={leftActivePortMask}
        leftConnectedPortCount={leftConnectedPortCount}
        leftConnectedPortMask={leftConnectedPortMask}
        leftHandleCount={leftPortCount}
        rightActivePortCount={rightActivePortCount}
        rightActivePortMask={rightActivePortMask}
        rightConnectedPortCount={rightConnectedPortCount}
        rightConnectedPortMask={rightConnectedPortMask}
        rightHandleCount={rightPortCount}
        runStatus={nodeRunStatus}
        selected={selected}
        theme="violet"
        onLabelChange={handleLabelChange}
      >
        {data.config && Object.keys(data.config).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nodes.operation.config")}
            </p>
            <div className="rounded bg-surface-2 px-2 py-1.5 ring-1 ring-border">
              <pre className="overflow-hidden text-ellipsis text-[9px] text-muted-foreground">
                {JSON.stringify(data.config, null, 2).slice(0, 100)}
                {JSON.stringify(data.config).length > 100 ? "..." : ""}
              </pre>
            </div>
          </div>
        )}

        {operation?.acceptedObjectTypes && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nodes.operation.acceptedObjectTypes")}
            </p>
            <div className="flex flex-wrap gap-1">
              {operation.acceptedObjectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 dark:text-violet-300"
                >
                  {objectTypeLabels[type] ?? type}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="nodrag nopan space-y-1.5" {...canvasInteractionHandlers}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Brain className="mr-1 inline-block h-3 w-3" />
            {t("nodes.operation.agent")}
          </p>
          <Select
            open={agentOpen}
            value={selectedAgentId || "__default__"}
            onOpenChange={handleAgentDropdownChange}
            onValueChange={handleAgentValueChange}
          >
            <SelectTrigger
              aria-label={t("nodes.operation.agent")}
              className="nodrag nopan h-8 w-full min-w-0 px-2.5 text-xs"
            >
              <span className="truncate">{selectedAgentLabel}</span>
            </SelectTrigger>
            <SelectContent
              align="start"
              alignItemWithTrigger={false}
              className="nodrag nopan min-w-44"
              sideOffset={6}
            >
              <SelectGroup>
                <SelectLabel>{t("nodes.operation.agent")}</SelectLabel>
                <SelectItem value="__default__">{t("nodes.operation.defaultAgent")}</SelectItem>
                {isAgentIncompatible && (
                  <SelectItem disabled value={selectedAgentId}>
                    {selectedAgent.name} ({t("nodes.operation.agentIncompatible")})
                  </SelectItem>
                )}
                {selectableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {hasLlmContent && (
          <div className="flex items-center gap-1 rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-700 dark:text-violet-300">
            <Brain className="h-3 w-3 shrink-0" />
            <span>{t("nodes.operation.inspectLlmOutput")}</span>
          </div>
        )}

        <div className="nodrag nopan space-y-1.5" {...canvasInteractionHandlers}>
          <button
            className={cn(
              "nodrag nopan flex h-8 w-full items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
              data.loopEnabled
                ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "border-border bg-surface-2 text-muted-foreground hover:bg-muted",
            )}
            type="button"
            onClick={handleLoopButtonClick}
          >
            <Repeat className="h-3 w-3 shrink-0" />
            {data.loopEnabled ? t("nodes.operation.loopEnabled") : t("nodes.operation.enableLoop")}
          </button>

          {data.loopEnabled && (
            <div className="space-y-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {t("nodes.operation.maxLoopCount")}
                </span>
                <input
                  aria-label={t("nodes.operation.maxLoopCountAria")}
                  className="nodrag nopan h-7 w-16 rounded border border-amber-500/25 bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  max={20}
                  min={1}
                  name={`${id}-maxLoopCount`}
                  type="number"
                  value={data.maxLoopCount ?? 3}
                  onChange={(e) =>
                    handleOperationMaxLoopChange(id, Number.parseInt(e.target.value, 10))
                  }
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  {t("nodes.operation.acceptanceCondition")}
                </span>
                <textarea
                  aria-label={t("nodes.operation.loopConditionAria")}
                  className="nodrag nopan min-h-16 w-full rounded border border-amber-500/25 bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/40"
                  name={`${id}-loopCondition`}
                  placeholder={t("nodes.operation.loopConditionPlaceholder")}
                  rows={2}
                  value={data.loopConditionPrompt ?? ""}
                  onChange={(e) => handleOperationConditionChange(id, e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </NodeCard>
    </div>
  );
};
