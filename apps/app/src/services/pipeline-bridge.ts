import { createPipelineRunner, type PipelineEngineDeps } from "@repo/pipeline-engine";
import { runPrompt, runSkill, structuredJsonToMarkdown } from "@/mastra";

const deps: PipelineEngineDeps = {
  runPrompt,
  runSkill,
  structuredJsonToMarkdown,
};

export const runPipeline = createPipelineRunner(deps);
export type { PipelineRunError, NodeCtx } from "@repo/pipeline-engine";
