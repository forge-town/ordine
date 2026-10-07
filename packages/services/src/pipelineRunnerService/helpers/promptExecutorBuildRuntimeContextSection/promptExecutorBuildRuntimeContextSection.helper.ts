import type { OperationRuntimeContext } from "@repo/pipeline-engine";

import type { PromptExecutorAssemblyBindings } from "../../contracts";
export const createPromptExecutorBuildRuntimeContextSectionHelper =
  (_serviceBindings: Pick<PromptExecutorAssemblyBindings, never>) =>
  (runtimeContext?: OperationRuntimeContext): string => {
    if (!runtimeContext) return "";

    const pipelineLines = runtimeContext.pipeline
      ? [
          "### Pipeline-global context",
          `Pipeline name: ${runtimeContext.pipeline.name}`,
          `Pipeline description: ${runtimeContext.pipeline.description || "(none)"}`,
          `Pipeline shared context: ${runtimeContext.pipeline.sharedContext || "(none)"}`,
          "",
        ]
      : [];

    const operation = runtimeContext.operation;
    const operationLines = [
      "### Operation-local context",
      `Operation name: ${operation.name}`,
      `Operation description: ${operation.description || "(none)"}`,
      ...(operation.instruction ? [`Step-specific instruction: ${operation.instruction}`] : []),
    ];

    return ["## Runtime Context", ...pipelineLines, ...operationLines].join("\n");
  };
