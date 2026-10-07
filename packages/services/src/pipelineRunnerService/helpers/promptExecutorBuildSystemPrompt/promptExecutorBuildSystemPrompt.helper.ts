import type { OperationRuntimeContext } from "@repo/pipeline-engine";

import type { PromptExecutorAssemblyBindings } from "../../contracts";
export const createPromptExecutorBuildSystemPromptHelper =
  (serviceBindings: Pick<PromptExecutorAssemblyBindings, "buildRuntimeContextSection">) =>
  ({
    prompt,
    runtimeContext,
  }: {
    prompt: string;
    runtimeContext?: OperationRuntimeContext;
  }): string => {
    const contextSection = (0, serviceBindings.buildRuntimeContextSection)(runtimeContext);
    if (!contextSection) return prompt;

    return [
      contextSection,
      "",
      "## Execution Priority",
      "Use the pipeline-global context to preserve workflow intent, but execute the current Operation-local instruction as the immediate task.",
      "",
      "## Operation Prompt",
      prompt,
    ].join("\n");
  };
