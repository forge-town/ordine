import { Pipeline } from "./pipeline/Pipeline.js";
import type { PipelineOptions, PipelineRunResult } from "./pipeline/Pipeline.js";

export class PipelineEngine {
  async execute(opts: PipelineOptions): Promise<PipelineRunResult> {
    const pipeline = new Pipeline(opts);
    return pipeline.run();
  }
}

export const pipelineEngine = new PipelineEngine();
