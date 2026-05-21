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

const outputModeLabels: Record<OutputMode, string> = {
  overwrite: "Overwrite",
  error_if_exists: "Error if exists",
  auto_rename: "Auto rename",
};

const fieldId = (nodeId: string, field: string) => `canvas-properties-${nodeId}-${field}`;

export const CanvasNodePropertiesPanel = () => {
  const store = useCanvasPageStore();
  const selectedNode = useStore(store, selectSelectedNode);
  const updateNodeData = useStore(store, (state) => state.updateNodeData);
  const clearSelection = useStore(store, (state) => state.clearSelection);
  const handleBackToComponentsClick = () => {
    clearSelection();
  };

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col bg-background p-4">
        <p className="text-sm text-muted-foreground">Select a canvas node to configure it.</p>
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
          Back to components
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
          label: "Label",
          value: String(data.label ?? ""),
        })}

        {data.nodeType === "file" && (
          <>
            {renderTextField({
              field: "filePath",
              label: "File path",
              placeholder: "src/file.tsx",
              value: data.filePath,
            })}
            {renderTextField({
              field: "language",
              label: "Language",
              placeholder: "typescript",
              value: data.language ?? "",
            })}
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "folder" && (
          <>
            {renderTextField({
              field: "folderPath",
              label: "Folder path",
              placeholder: "src/components",
              value: data.folderPath,
            })}
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "github-project" && (
          <>
            {renderTextField({
              field: "owner",
              label: "Owner",
              value: data.owner,
            })}
            {renderTextField({
              field: "repo",
              label: "Repository",
              value: data.repo,
            })}
            {renderTextField({
              field: "branch",
              label: "Branch",
              value: data.branch ?? "",
            })}
            {renderTextField({
              field: "localPath",
              label: "Local path",
              value: data.localPath ?? "",
            })}
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "prompt" && (
          <>
            {renderTextareaField({
              field: "prompt",
              label: "Prompt",
              value: data.prompt,
            })}
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "operation" && (
          <>
            {renderTextField({
              field: "operationName",
              label: "Operation name",
              value: data.operationName,
            })}
            {renderTextField({
              field: "agentId",
              label: "Agent ID",
              value: data.agentId ?? "",
            })}
            {renderTextField({
              field: "maxLoopCount",
              label: "Max loop count",
              value: String(data.maxLoopCount ?? 3),
            })}
            {renderTextareaField({
              field: "loopConditionPrompt",
              label: "Loop condition",
              value: data.loopConditionPrompt ?? "",
            })}
          </>
        )}

        {data.nodeType === "output-project-path" && (
          <>
            {renderTextField({
              field: "projectId",
              label: "Project ID",
              value: data.projectId ?? "",
            })}
            {renderTextField({
              field: "path",
              label: "Output path",
              value: data.path,
            })}
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "output-local-path" && (
          <>
            {renderTextField({
              field: "localPath",
              label: "Local path",
              value: data.localPath,
            })}
            {renderTextField({
              field: "outputFileName",
              label: "Output file name",
              value: data.outputFileName ?? "",
            })}
            <div className="space-y-1.5">
              <Label>Write mode</Label>
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
                      {outputModeLabels[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderTextareaField({
              field: "description",
              label: "Description",
              value: data.description ?? "",
            })}
          </>
        )}

        {data.nodeType === "compound" &&
          renderTextareaField({
            field: "description",
            label: "Description",
            value: data.description ?? "",
          })}
      </div>
    </div>
  );
};
