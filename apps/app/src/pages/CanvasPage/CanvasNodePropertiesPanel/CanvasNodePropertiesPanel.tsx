import {
  ArrowLeft,
  Box,
  FileCode,
  Folder,
  FolderOutput,
  HardDrive,
  MessageSquareText,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { OUTPUT_MODE_ENUM, type OutputMode } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { selectSelectedNode, useCanvasPageStore } from "../_store";
import { getNodeMeta } from "../utils/nodeTypeMeta";

const outputModeLabelKeys = {
  overwrite: "canvas.propertiesPanel.outputMode.overwrite",
  error_if_exists: "canvas.propertiesPanel.outputMode.errorIfExists",
  auto_rename: "canvas.propertiesPanel.outputMode.autoRename",
} as const satisfies Record<OutputMode, string>;

const fieldId = (nodeId: string, field: string) => `canvas-properties-${nodeId}-${field}`;

export const CanvasNodePropertiesPanel = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const selectedNode = useStore(store, selectSelectedNode);
  const updateNodeData = useStore(store, (state) => state.updateNodeData);
  const handleOperationMaxLoopChange = useStore(
    store,
    (state) => state.handleOperationMaxLoopChange,
  );
  const clearSelection = useStore(store, (state) => state.clearSelection);
  const handleBackToComponentsClick = () => {
    clearSelection();
  };

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col bg-background p-4">
        <p className="text-sm text-muted-foreground">{t("canvas.propertiesPanel.empty")}</p>
      </div>
    );
  }

  const data = selectedNode.data;
  const meta = getNodeMeta(selectedNode.type);
  const Icon =
    selectedNode.type === "file"
      ? FileCode
      : selectedNode.type === "folder"
        ? Folder
        : selectedNode.type === "github-project"
          ? SiGitHubIcon
          : selectedNode.type === "prompt"
            ? MessageSquareText
            : selectedNode.type === "operation"
              ? Zap
              : selectedNode.type === "output-project-path"
                ? FolderOutput
                : selectedNode.type === "output-local-path"
                  ? HardDrive
                  : Box;
  const handleUpdateNodeData = (patch: Record<string, unknown>) => {
    updateNodeData(selectedNode.id, patch);
  };

  const renderTextField = ({
    field,
    label,
    placeholder,
    value,
  }: {
    field: string;
    label: string;
    placeholder?: string;
    value: string;
  }) => {
    const id = fieldId(selectedNode.id, field);

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name={id}
          placeholder={placeholder}
          value={value}
          onChange={(event) => handleUpdateNodeData({ [field]: event.target.value })}
        />
      </div>
    );
  };

  const renderTextareaField = ({
    field,
    label,
    placeholder,
    value,
  }: {
    field: string;
    label: string;
    placeholder?: string;
    value: string;
  }) => {
    const id = fieldId(selectedNode.id, field);

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Textarea
          id={id}
          name={id}
          placeholder={placeholder}
          rows={4}
          value={value}
          onChange={(event) => handleUpdateNodeData({ [field]: event.target.value })}
        />
      </div>
    );
  };

  const renderIntegerField = ({
    field,
    label,
    max,
    min,
    value,
    handleValueChange,
  }: {
    field: string;
    label: string;
    max?: number;
    min?: number;
    value: number;
    handleValueChange: (value: number) => void;
  }) => {
    const id = fieldId(selectedNode.id, field);
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.currentTarget.valueAsNumber;

      if (Number.isFinite(nextValue) && Number.isInteger(nextValue)) {
        const lowerBound = min ?? Number.NEGATIVE_INFINITY;
        const upperBound = max ?? Number.POSITIVE_INFINITY;
        handleValueChange(Math.min(Math.max(nextValue, lowerBound), upperBound));
      }
    };

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          inputMode="numeric"
          max={max}
          min={min}
          name={id}
          step={1}
          type="number"
          value={value}
          onChange={handleInputChange}
        />
      </div>
    );
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background"
      data-testid="canvas-properties-panel"
    >
      <div className="border-b p-4">
        <Button
          className="mb-3 h-8 gap-2 px-2 text-muted-foreground"
          type="button"
          variant="ghost"
          onClick={handleBackToComponentsClick}
        >
          <ArrowLeft className="size-4" />
          {t("canvas.propertiesPanel.backToComponents")}
        </Button>
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-md ${meta?.iconBg ?? "bg-slate-500"}`}
          >
            <Icon className="size-4 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.label}</p>
            <p className="text-xs text-muted-foreground">{selectedNode.type}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {renderTextField({
          field: "label",
          label: t("canvas.propertiesPanel.fields.label"),
          value: String(data.label ?? ""),
        })}

        {data.nodeType === "file" && (
          <>
            {renderTextField({
              field: "filePath",
              label: t("canvas.propertiesPanel.fields.filePath"),
              placeholder: t("canvas.propertiesPanel.placeholders.filePath"),
              value: data.filePath,
            })}
            {renderTextField({
              field: "language",
              label: t("canvas.propertiesPanel.fields.language"),
              placeholder: t("canvas.propertiesPanel.placeholders.language"),
              value: data.language ?? "",
            })}
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "folder" && (
          <>
            {renderTextField({
              field: "folderPath",
              label: t("canvas.propertiesPanel.fields.folderPath"),
              placeholder: t("canvas.propertiesPanel.placeholders.folderPath"),
              value: data.folderPath,
            })}
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "github-project" && (
          <>
            {renderTextField({
              field: "owner",
              label: t("canvas.propertiesPanel.fields.owner"),
              value: data.owner,
            })}
            {renderTextField({
              field: "repo",
              label: t("canvas.propertiesPanel.fields.repository"),
              value: data.repo,
            })}
            {renderTextField({
              field: "branch",
              label: t("canvas.propertiesPanel.fields.branch"),
              value: data.branch ?? "",
            })}
            {renderTextField({
              field: "localPath",
              label: t("canvas.propertiesPanel.fields.localPath"),
              value: data.localPath ?? "",
            })}
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "prompt" && (
          <>
            {renderTextareaField({
              field: "prompt",
              label: t("canvas.propertiesPanel.fields.prompt"),
              value: data.prompt,
            })}
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "operation" && (
          <>
            {renderTextField({
              field: "operationName",
              label: t("canvas.propertiesPanel.fields.operationName"),
              value: data.operationName,
            })}
            {renderTextField({
              field: "agentId",
              label: t("canvas.propertiesPanel.fields.agentId"),
              value: data.agentId ?? "",
            })}
            {renderIntegerField({
              field: "maxLoopCount",
              label: t("canvas.propertiesPanel.fields.maxLoopCount"),
              max: 20,
              min: 1,
              value: data.maxLoopCount ?? 3,
              handleValueChange: (value) => handleOperationMaxLoopChange(selectedNode.id, value),
            })}
            {renderTextareaField({
              field: "loopConditionPrompt",
              label: t("canvas.propertiesPanel.fields.loopCondition"),
              value: data.loopConditionPrompt ?? "",
            })}
          </>
        )}

        {data.nodeType === "output-project-path" && (
          <>
            {renderTextField({
              field: "projectId",
              label: t("canvas.propertiesPanel.fields.projectId"),
              value: data.projectId ?? "",
            })}
            {renderTextField({
              field: "path",
              label: t("canvas.propertiesPanel.fields.outputPath"),
              value: data.path,
            })}
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "output-local-path" && (
          <>
            {renderTextField({
              field: "localPath",
              label: t("canvas.propertiesPanel.fields.localPath"),
              value: data.localPath,
            })}
            {renderTextField({
              field: "outputFileName",
              label: t("canvas.propertiesPanel.fields.outputFileName"),
              value: data.outputFileName ?? "",
            })}
            <div className="space-y-1.5">
              <Label>{t("canvas.propertiesPanel.fields.writeMode")}</Label>
              <Select
                value={data.outputMode ?? "overwrite"}
                onValueChange={(value) => handleUpdateNodeData({ outputMode: value as OutputMode })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(OUTPUT_MODE_ENUM).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(outputModeLabelKeys[mode])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "compound" &&
          renderTextareaField({
            field: "description",
            label: t("canvas.propertiesPanel.fields.description"),
            value: data.description ?? "",
          })}
      </div>
    </div>
  );
};
