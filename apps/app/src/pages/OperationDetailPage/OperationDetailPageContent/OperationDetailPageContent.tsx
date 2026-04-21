import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  FileCode,
  Folder,
  FolderGit2,
  FileInput,
  FileOutput,
  Info,
  Tag,
  Terminal,
  Wand2,
  XCircle,
  Pencil,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import type { OperationRecord } from "@repo/db-schema";
import type { ObjectType } from "@repo/schemas";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/operations.$operationId.index";
import { SectionHeader } from "../SectionHeader";
import { InputPortRow } from "../InputPortRow";
import { OutputPortRow } from "../OutputPortRow";
import type {
  OperationConfig,
  OperationConfigInput,
  ExecutorConfig,
} from "@repo/pipeline-engine/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};

const EXECUTOR_ICON: Record<string, React.ElementType> = {
  agent: Wand2,
  script: Terminal,
};

const EXECUTOR_LABEL: Record<string, string> = {
  agent: "Agent",
  script: "Script",
};

const AGENT_MODE_LABEL: Record<string, string> = {
  skill: "Skill",
  prompt: "Prompt",
};

const parseConfig = (raw: OperationConfigInput): OperationConfig => {
  return {
    executor: raw.executor,
    inputs: Array.isArray(raw.inputs) ? raw.inputs : [],
    outputs: Array.isArray(raw.outputs) ? raw.outputs : [],
  };
};

const ExecutorCard = ({ executor: raw }: { executor: ExecutorConfig }) => {
  const { t } = useTranslation();
  const executor = raw;
  const Icon = EXECUTOR_ICON[executor.type] ?? Wand2;
  const modeLabel = executor.agentMode ? AGENT_MODE_LABEL[executor.agentMode] : undefined;
  const label = EXECUTOR_LABEL[executor.type] ?? executor.type;
  const displayLabel = modeLabel ? `${label} · ${modeLabel}` : label;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <SectionHeader icon={Icon} label={`执行方式 · ${displayLabel}`} />
      <div className="mt-3 space-y-2">
        {executor.type === "agent" && executor.agentMode === "skill" && executor.skillId && (
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground">Skill ID</span>
            <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
              {executor.skillId}
            </code>
          </div>
        )}
        {executor.type === "agent" && executor.agentMode === "prompt" && executor.prompt && (
          <div>
            <span className="text-xs text-muted-foreground">{t("operations.systemPrompt")}</span>
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

export const OperationDetailPageContent = () => {
  const { operationId } = Route.useParams();
  const { result: operationResult, query: operationQuery } = useOne<OperationRecord>({
    resource: ResourceName.operations,
    id: operationId,
  });
  const operation = operationResult ?? null;
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNavigateBack = () => void navigate({ to: "/operations" });

  if (operationQuery?.isLoading) {
    return <PageLoadingState title={t("operations.title")} variant="detail" />;
  }

  if (!operation) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("operations.operationNotFound")}
        </p>
        <button className="text-xs text-primary hover:underline" onClick={handleNavigateBack}>
          {t("common.backToList")}
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
          aria-label={t("common.backToList")}
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
        <Button
          aria-label={t("common.edit")}
          size="sm"
          variant="outline"
          onClick={handleNavigateToEdit}
        >
          <Pencil className="h-4 w-4" />
          {t("common.edit")}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Meta card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Info} label={t("operations.basicInfo")} />
          {operation.description && (
            <p className="mb-4 text-sm leading-relaxed text-foreground">{operation.description}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("operations.applicableObjects")}
            </span>
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
          <SectionHeader icon={Tag} label={t("common.metadata")} />
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.createdAt")}
              </span>
              <span className="text-xs text-foreground">
                {new Date(operation.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.updatedAt")}
              </span>
              <span className="text-xs text-foreground">
                {new Date(operation.updatedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
