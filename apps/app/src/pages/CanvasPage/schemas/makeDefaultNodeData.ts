import type { NodeType } from "@repo/pipeline-engine/schemas";
import type { PipelineNodeData } from "./PipelineNodeDataSchema";

export const makeDefaultNodeData = (type: NodeType): PipelineNodeData => {
  switch (type) {
    case "operation": {
      return {
        label: "Operation",
        nodeType: "operation",
        operationId: "",
        operationName: "",
        status: "idle",
        config: {},
      };
    }
    case "code-file": {
      return {
        label: "代码文件",
        nodeType: "code-file",
        filePath: "",
        language: "typescript",
        description: "",
      };
    }
    case "folder": {
      return {
        label: "文件夹",
        nodeType: "folder",
        folderPath: "",
        description: "",
      };
    }
    case "github-project": {
      return {
        label: "GitHub 项目",
        nodeType: "github-project",
        owner: "",
        repo: "",
        branch: "main",
        description: "",
      };
    }
    case "output-project-path": {
      return {
        label: "项目路径输出",
        nodeType: "output-project-path",
        projectId: "",
        path: "",
        description: "",
      };
    }
    case "output-local-path": {
      return {
        label: "本地路径输出",
        nodeType: "output-local-path",
        localPath: "",
        description: "",
      };
    }
    case "compound": {
      return {
        label: "复合节点",
        nodeType: "compound",
        childNodeIds: [],
        description: "",
      };
    }
    case "condition": {
      return {
        label: "条件节点",
        nodeType: "condition",
        expression: "",
        expectedResult: "",
        status: "idle",
      };
    }
  }
};
