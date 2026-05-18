import { vi } from "vitest";
import type { PipelineEngineDeps } from "../../deps";
import { pipelineEngine } from "../../engine";
import type { PipelineOptions } from "../../pipeline";
import type { PipelineEdge, PipelineNode } from "@repo/schemas";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

export interface ScenarioOptions extends Partial<PipelineOptions> {
  nodes: PipelineNode[];
  edges?: PipelineEdge[];
  deps: PipelineEngineDeps;
}

export const makePipelineScenario = ({
  nodes,
  edges = [],
  deps,
  ...extra
}: ScenarioOptions): PipelineOptions => ({
  pipeline: {
    id: "scenario-pipeline",
    name: "Scenario Pipeline",
    nodes,
    edges,
  },
  jobId: "job-12345678",
  operations: new Map(),
  deps,
  lookupAgent: async () => null,
  lookupSkill: async () => null,
  ...extra,
});

export const executeScenario = (options: ScenarioOptions) =>
  pipelineEngine.execute(makePipelineScenario(options));
