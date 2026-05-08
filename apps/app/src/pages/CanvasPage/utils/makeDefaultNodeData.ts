import type { BuiltinNodeType } from "@repo/pipeline-engine/schemas";
import type { PipelineNodeData } from "../schemas/PipelineNodeDataSchema";

export const makeDefaultNodeData = (
  type: BuiltinNodeType,
  options?: { label?: string }
): PipelineNodeData => {
  switch (type) {
    case "operation": {
      return {
        label: options?.label ?? "Operation",
        nodeType: "operation",
        operationId: "",
        operationName: "",
        status: "idle",
        config: {},
      };
    }
    case "code-file": {
      return {
        label: options?.label ?? "Code file",
        nodeType: "code-file",
        filePath: "",
        language: "typescript",
        description: "",
      };
    }
    case "folder": {
      return {
        label: options?.label ?? "Folder",
        nodeType: "folder",
        folderPath: "",
        description: "",
      };
    }
    case "github-projects": {
      return {
        label: options?.label ?? "GitHub project",
        nodeType: "github-projects",
        owner: "",
        repo: "",
        branch: "main",
        description: "",
      };
    }
    case "output-project-path": {
      return {
        label: options?.label ?? "Project output",
        nodeType: "output-project-path",
        projectId: "",
        path: "",
        description: "",
      };
    }
    case "output-local-path": {
      return {
        label: options?.label ?? "Local output",
        nodeType: "output-local-path",
        localPath: "",
        description: "",
      };
    }
    case "compound": {
      return {
        label: options?.label ?? "Compound node",
        nodeType: "compound",
        childNodeIds: [],
        description: "",
      };
    }
    case "prompt": {
      return {
        label: "提示词",
        nodeType: "prompt",
        prompt: "",
      };
    }
  }
};
