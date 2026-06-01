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
import { useList } from "@refinedev/core";
import {
  OUTPUT_MODE_ENUM,
  DISCLOSURE_MODE_ENUM,
  SOURCE_TYPE_ENUM,
  type OutputMode,
  type Agent,
  type Operation,
  type DisclosureMode,
  type SourceType,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import { SiGitHubIcon } from "@/components/icons/SiGitHubIcon";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { selectSelectedNode, useCanvasPageStore } from "../_store";
import { getNodeMeta } from "../utils/nodeTypeMeta";
import { CanvasOperationPropertiesForm } from "./CanvasOperationPropertiesForm";
import { ExcludedPathsField } from "./ExcludedPathsField";

const outputModeLabelKeys = {
  overwrite: "canvas.propertiesPanel.outputMode.overwrite",
  error_if_exists: "canvas.propertiesPanel.outputMode.errorIfExists",
  auto_rename: "canvas.propertiesPanel.outputMode.autoRename",
} as const satisfies Record<OutputMode, string>;

const disclosureModeLabelKeys = {
  tree: "canvas.disclosureTree",
  "files-only": "canvas.disclosureFilesOnly",
  full: "canvas.disclosureFull",
} as const satisfies Record<DisclosureMode, string>;

const sourceTypeLabelKeys = {
  github: "canvas.sourceTypeGitHub",
  local: "canvas.sourceTypeLocal",
} as const satisfies Record<SourceType, string>;

const fieldId = (nodeId: string, field: string) => `canvas-properties-${nodeId}-${field}`;

export const CanvasNodePropertiesPanel = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const selectedNode = useStore(store, selectSelectedNode);
  const updateNodeData = useStore(store, (state) => state.updateNodeData);
  const handleOperationLabelChange = useStore(store, (state) => state.handleOperationLabelChange);
  const handleOperationAgentChange = useStore(store, (state) => state.handleOperationAgentChange);
  const handleOperationMaxLoopChange = useStore(
    store,
    (state) => state.handleOperationMaxLoopChange,
  );
  const handleNodeAddExcludedPath = useStore(store, (state) => state.handleNodeAddExcludedPath);
  const handleNodeRemoveExcludedPath = useStore(
    store,
    (state) => state.handleNodeRemoveExcludedPath,
  );
  const clearSelection = useStore(store, (state) => state.clearSelection);
  const handleClearSelection = () => clearSelection();
  const { result: agentsResult } = useList<Agent>({
    resource: ResourceName.agents,
  });
  const agents = agentsResult.data;

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

  const handleOperationUpdated = (operation: Operation) => {
    handleOperationLabelChange(selectedNode.id, operation.name);
  };

  const renderTextField = ({
    field,
    label,
    placeholder,
    value,
    onChangeValue,
  }: {
    field: string;
    label: string;
    placeholder?: string;
    value: string;
    onChangeValue?: (value: string) => void;
  }) => {
    const id = fieldId(selectedNode.id, field);
    const handleTextFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChangeValue) {
        onChangeValue(event.target.value);

        return;
      }

      handleUpdateNodeData({ [field]: event.target.value });
    };

    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          name={id}
          placeholder={placeholder}
          value={value}
          onChange={handleTextFieldChange}
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
          onClick={handleClearSelection}
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
          onChangeValue:
            data.nodeType === "operation"
              ? (value) => handleOperationLabelChange(selectedNode.id, value)
              : undefined,
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("canvas.propertiesPanel.fields.disclosureMode")}
              </Label>
              <Select
                value={data.disclosureMode ?? DISCLOSURE_MODE_ENUM.TREE}
                onValueChange={(value) =>
                  handleUpdateNodeData({ disclosureMode: value as DisclosureMode })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.values(DISCLOSURE_MODE_ENUM) as DisclosureMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {t(disclosureModeLabelKeys[mode])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("canvas.propertiesPanel.fields.includedExtensions")}
              </Label>
              <Input
                className="h-8 text-sm"
                placeholder="ts,tsx,js,jsx"
                value={(data.includedExtensions ?? []).join(",")}
                onChange={(e) =>
                  handleUpdateNodeData({
                    includedExtensions: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <ExcludedPathsField
              excludedPaths={data.excludedPaths}
              nodeId={selectedNode.id}
              onAdd={handleNodeAddExcludedPath}
              onRemove={handleNodeRemoveExcludedPath}
            />
            {renderTextareaField({
              field: "description",
              label: t("canvas.propertiesPanel.fields.description"),
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "github-project" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("canvas.propertiesPanel.fields.sourceType")}
              </Label>
              <Select
                value={data.sourceType ?? SOURCE_TYPE_ENUM.GITHUB}
                onValueChange={(value) => handleUpdateNodeData({ sourceType: value as SourceType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.values(SOURCE_TYPE_ENUM) as SourceType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(sourceTypeLabelKeys[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            {data.sourceType !== SOURCE_TYPE_ENUM.LOCAL && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("canvas.propertiesPanel.fields.disclosureMode")}
                </Label>
                <Select
                  value={data.disclosureMode ?? DISCLOSURE_MODE_ENUM.TREE}
                  onValueChange={(value) =>
                    handleUpdateNodeData({ disclosureMode: value as DisclosureMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.values(DISCLOSURE_MODE_ENUM) as DisclosureMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {t(disclosureModeLabelKeys[mode])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <ExcludedPathsField
              excludedPaths={data.excludedPaths}
              nodeId={selectedNode.id}
              onAdd={handleNodeAddExcludedPath}
              onRemove={handleNodeRemoveExcludedPath}
            />
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
            <div className="space-y-1.5">
              <Label htmlFor={fieldId(selectedNode.id, "agentId")}>
                {t("canvas.propertiesPanel.fields.agentId")}
              </Label>
              <Select
                value={data.agentId ?? "__default__"}
                onValueChange={(value) =>
                  handleOperationAgentChange(
                    selectedNode.id,
                    value === "__default__" ? null : value,
                  )
                }
              >
                <SelectTrigger id={fieldId(selectedNode.id, "agentId")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">{t("nodes.operation.defaultAgent")}</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="border-t pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("canvas.propertiesPanel.operationDefinition")}
              </p>
              <CanvasOperationPropertiesForm
                operationId={data.operationId}
                onOperationUpdated={handleOperationUpdated}
              />
            </div>
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
