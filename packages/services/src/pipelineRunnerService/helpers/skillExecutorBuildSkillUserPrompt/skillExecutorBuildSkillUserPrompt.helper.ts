import type { OperationRuntimeContext } from "@repo/pipeline-engine";
import type { OutputItem } from "@repo/schemas";

import type { SkillExecutorAssemblyBindings } from "../../contracts";
export const createSkillExecutorBuildSkillUserPromptHelper =
  (
    serviceBindings: Pick<
      SkillExecutorAssemblyBindings,
      "CHECK_OUTPUT_EXAMPLE" | "FIX_OUTPUT_EXAMPLE"
    >,
  ) =>
  ({
    skillId,
    skillDescription,
    inputContent,
    inputPath,
    outputItems,
    outputDir,
    runtimeContext,
  }: {
    skillId: string;
    skillDescription: string;
    inputContent: string;
    inputPath: string;
    outputItems?: readonly OutputItem[];
    outputDir?: string;
    runtimeContext?: OperationRuntimeContext;
  }): string => {
    const pipelineContextLines = runtimeContext?.pipeline
      ? [
          "### Pipeline-global context",
          `Pipeline name: ${runtimeContext.pipeline.name}`,
          `Pipeline description: ${runtimeContext.pipeline.description || "(none)"}`,
          `Pipeline shared context: ${runtimeContext.pipeline.sharedContext || "(none)"}`,
          "",
        ]
      : [];
    const operationContextLines = runtimeContext
      ? [
          "### Operation-local context",
          `Operation name: ${runtimeContext.operation.name}`,
          `Operation description: ${runtimeContext.operation.description || "(none)"}`,
          ...(runtimeContext.operation.instruction
            ? [`Step-specific instruction: ${runtimeContext.operation.instruction}`]
            : []),
          "",
          "Use the pipeline-global context to preserve workflow intent, but execute the current Operation-local instruction as the immediate task.",
          "",
        ]
      : [];
    const outputItemsSection =
      outputItems && outputItems.length > 0
        ? [
            "",
            "## Expected Output Items",
            "Your response MUST include ALL of the following output items.",
            ...(outputDir ? [`Write all output files to the directory: ${outputDir}`] : []),
            'Include the file paths in an "outputs" field in your JSON response.',
            ...outputItems.map(
              (item, i) =>
                `${i + 1}. **${item.name}** (${item.contentType})${item.description ? `: ${item.description}` : ""}`,
            ),
            "",
          ]
        : [];

    return [
      ...(runtimeContext
        ? ["## Runtime Context", ...pipelineContextLines, ...operationContextLines]
        : []),
      `Skill ID: ${skillId}`,
      `Skill description: ${skillDescription}`,
      "",
      "Execute the skill description against the provided project input.",
      "Inspect the actual project files before making conclusions.",
      "",
      "Output ONLY a JSON object.",
      "Use the check structure when reporting findings:",
      JSON.stringify(serviceBindings.CHECK_OUTPUT_EXAMPLE, null, 2),
      "",
      "Use the fix structure when reporting applied changes:",
      JSON.stringify(serviceBindings.FIX_OUTPUT_EXAMPLE, null, 2),
      "",
      ...outputItemsSection,
      inputPath ? `Project path: ${inputPath}` : "",
      "",
      "Input:",
      inputContent,
    ]
      .filter((line) => line !== "")
      .join("\n");
  };
