import { Pipeline } from "./pipeline/Pipeline.js";
import type {
  PipelineOptions,
  PipelineRunResult,
  PipelineDefinition,
} from "./pipeline/Pipeline.js";
import { CycleDetectedError } from "./dagScheduler.js";

export { CycleDetectedError };
export type { PipelineRunResult, PipelineDefinition };
export type { OperationInfo, SkillInfo } from "./nodes/types.js";

export type ExecutePipelineOpts = PipelineOptions;

export class PipelineEngine {
  async execute(opts: ExecutePipelineOpts): Promise<PipelineRunResult> {
    const pipeline = new Pipeline(opts);
    return pipeline.run();
  }
}

export const pipelineEngine = new PipelineEngine();
