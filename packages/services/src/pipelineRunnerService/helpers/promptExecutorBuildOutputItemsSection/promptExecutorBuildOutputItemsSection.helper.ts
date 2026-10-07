import type { OutputItem } from "@repo/schemas";

import type { PromptExecutorAssemblyBindings } from "../../contracts";
export const createPromptExecutorBuildOutputItemsSectionHelper =
  (_serviceBindings: Pick<PromptExecutorAssemblyBindings, never>) =>
  (outputItems?: readonly OutputItem[], outputDir?: string): string => {
    if (!outputItems || outputItems.length === 0) return "";
    const lines = [
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
    ];

    return lines.join("\n");
  };
