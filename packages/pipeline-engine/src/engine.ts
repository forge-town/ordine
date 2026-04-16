import { Pipeline } from "./pipeline";
import type { PipelineOptions, PipelineRunResult } from "./pipeline";

export class PipelineEngine {
  async execute(opts: PipelineOptions): Promise<PipelineRunResult> {
    const pipeline = new Pipeline(opts);
    return pipeline.run();
  }
}

export const pipelineEngine = new PipelineEngine();
