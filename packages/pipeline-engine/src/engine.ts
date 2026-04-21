import { Pipeline, type PipelineOptions, type PipelineRunResult } from "./pipeline";

export class PipelineEngine {
  async execute(opts: PipelineOptions): Promise<PipelineRunResult> {
    const pipeline = new Pipeline(opts);

    return pipeline.run();
  }
}

export const pipelineEngine = new PipelineEngine();
