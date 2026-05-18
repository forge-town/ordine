import {
  FileCode,
  Folder,
  FolderGit2,
  FileInput,
  Info,
  Tag,
  MessageSquareText,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOne } from "@refinedev/core";
import type { Operation, ObjectType } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/pipelines.operations.$operationId.index";
import { SectionHeader } from "../SectionHeader";
import { InputPortRow } from "../InputPortRow";
import { ExecutorCard } from "./ExecutorCard";

const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  "github-project": FolderGit2,
  prompt: MessageSquareText,
};

export const OperationMetaPanel = () => {
  const { t } = useTranslation();
  const { operationId } = Route.useParams();
  const { result: operation } = useOne<Operation>({
    resource: ResourceName.operations,
    id: operationId,
  });

  if (!operation) return null;

  const inputs = Array.isArray(operation.config.inputs) ? operation.config.inputs : [];
  const executor = operation.config.executor;

  return (
    <div className="w-72 shrink-0 border-l border-border overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Basic info */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Info} label={t("operations.basicInfo")} />
          {operation.description && (
            <p className="mb-3 text-sm leading-relaxed text-foreground">{operation.description}</p>
          )}
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("operations.applicableObjects")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {operation.acceptedObjectTypes.map((type) => {
                const Icon = OBJECT_TYPE_ICONS[type] ?? HelpCircle;

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

        {/* Executor */}
        {executor && <ExecutorCard executor={executor} />}

        {/* Inputs */}
        {inputs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <SectionHeader
              icon={FileInput}
              label={`${t("operations.inputs")} (${inputs.length})`}
            />
            <div>
              {inputs.map((port) => (
                <InputPortRow key={port.name} port={port} />
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="rounded-xl border border-border bg-card p-4">
          <SectionHeader icon={Tag} label={t("common.metadata")} />
          <div className="space-y-0">
            <div className="flex items-start gap-3 border-b border-border/50 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.createdAt")}
              </span>
              <span className="text-xs text-foreground">
                {operation.meta?.createdAt?.toLocaleString() ?? "-"}
              </span>
            </div>
            <div className="flex items-start gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {t("common.updatedAt")}
              </span>
              <span className="text-xs text-foreground">
                {operation.meta?.updatedAt?.toLocaleString() ?? "-"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
