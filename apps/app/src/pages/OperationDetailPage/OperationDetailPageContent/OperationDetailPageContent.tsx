import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  FileInput,
  FileOutput,
  Info,
  Puzzle,
  Tag,
  Terminal,
  Wand2,
  XCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { ObjectType } from "@/models/tables/operations_table";
import { SectionHeader } from "../SectionHeader";
import { InputPortRow } from "../InputPortRow";
import { OutputPortRow } from "../OutputPortRow";
import type { OperationConfig, ExecutorConfig } from "../types";

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};

const EXECUTOR_ICON: Record<string, React.ElementType> = {
  skill: Puzzle,
  prompt: Wand2,
  script: Terminal,
};

const EXECUTOR_LABEL: Record<string, string> = {
  skill: "Skill",
  prompt: "Prompt",
  script: "Script",
};

const parseConfig = (raw: string): OperationConfig => {
  try {
    const parsed = JSON.parse(raw) as Partial<OperationConfig>;
    return {
      executor: parsed.executor,
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      outputs: Array.isArray(parsed.outputs) ? parsed.outputs : [],
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
};

export type OperationDetailPageContentProps = {
  operation: OperationEntity | null;
};

const ExecutorCard = ({ executor }: { executor: ExecutorConfig }) => {
  const Icon = EXECUTOR_ICON[executor.type] ?? Puzzle;
  const label = EXECUTOR_LABEL[executor.type] ?? executor.type;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionHeader icon={Icon} label={`执行方式 · ${label}`} />
      <div className="mt-3 space-y-2">
        {executor.type === "skill" && executor.skillId && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Skill ID</span>
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {executor.skillId}
            </code>
          </div>
        )}
        {executor.type === "prompt" && executor.prompt && (
          <div>
            <span className="text-xs text-muted-foreground">系统提示词</span>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-foreground">
              {executor.prompt}
            </pre>
          </div>
        )}
        {executor.type === "script" && (
          <div className="flex items-start gap-2">
            {executor.language && (
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {executor.language}
              </span>
            )}
            {executor.command && (
              <code className="font-mono text-xs text-foreground">{executor.command}</code>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const OperationDetailPageContent = ({ operation }: OperationDetailPageContentProps) => {
  const navigate = useNavigate();

  const handleNavigateBack = () => void navigate({ to: "/operations" });

  if (!operation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">Operation 不存在</p>
        <button className="text-xs text-primary hover:underline" onClick={handleNavigateBack}>
          返回列表
        </button>
      </div>
    );
  }

  const config = parseConfig(operation.config);
  const handleNavigateToEdit = () =>
    void navigate({
      to: "/operations/$operationId/edit",
      params: { operationId: operation.id },
    });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label="返回列表"
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleNavigateBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{operation.name}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{operation.id}</p>
        </div>
        <Badge variant="secondary">{operation.category}</Badge>
        <Button aria-label="编辑" size="sm" variant="outline" onClick={handleNavigateToEdit}>
          <Pencil className="h-4 w-4" />
          编辑
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Meta card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Info} label="基本信息" />
          {operation.description && (
            <p className="mb-4 text-sm leading-relaxed text-foreground">{operation.description}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">适用对象</span>
            <div className="flex flex-wrap gap-1.5">
              {operation.acceptedObjectTypes.map((type) => {
                const Icon = OBJECT_TYPE_ICONS[type];
                return (
                  <span
                    key={type}
                    className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {type}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {config.executor && <ExecutorCard executor={config.executor} />}

        {config.inputs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionHeader icon={FileInput} label={`输入 (${config.inputs.length})`} />
            <div>
              {config.inputs.map((port) => (
                <InputPortRow key={port.name} port={port} />
              ))}
            </div>
          </div>
        )}

        {config.outputs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionHeader icon={FileOutput} label={`输出 (${config.outputs.length})`} />
            <div>
              {config.outputs.map((port) => (
                <OutputPortRow key={port.name} port={port} />
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Tag} label="元数据" />
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">创建时间</span>
              <span className="text-xs text-foreground">
                {new Date(operation.createdAt).toLocaleString("zh-CN")}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">更新时间</span>
              <span className="text-xs text-foreground">
                {new Date(operation.updatedAt).toLocaleString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
