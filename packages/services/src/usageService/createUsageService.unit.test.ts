import { beforeEach, describe, expect, it, vi } from "vitest";

const range = {
  from: new Date("2024-01-01T00:00:00Z"),
  to: new Date("2024-01-31T23:59:59Z"),
};

const usageDao = {
  getSummary: vi.fn().mockResolvedValue({
    totalTokens: 300,
    totalCost: "12.50",
    runCount: 2,
  }),
  getDailyCostSeries: vi.fn().mockResolvedValue([
    { date: "2024-01-01", cost: "1.25", tokens: 100 },
    { date: "2024-01-02", cost: "2.75", tokens: 200 },
  ]),
  getByPipeline: vi
    .fn()
    .mockResolvedValue([
      { pipelineId: "pipeline-1", totalTokens: 250, totalCost: "9.50", runCount: 2 },
    ]),
  getByAgent: vi.fn().mockResolvedValue([
    {
      agentRuntime: "codex",
      agentId: "agent-1",
      modelId: "gpt-5",
      tokens: 777,
      runCount: 3,
    },
  ]),
};

vi.mock("@repo/models", () => ({
  createUsageDao: () => usageDao,
}));

import { createUsageService } from "./createUsageService";

const expectOk = async (resultAsync: unknown) => {
  const result = (await resultAsync) as { isOk(): boolean; value: unknown };
  expect(result.isOk()).toBe(true);

  return result.value;
};

describe("createUsageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSummary returns aggregate totals and average cost per run", async () => {
    const service = createUsageService({} as never);
    const result = await expectOk(service.getSummary(range));

    expect(usageDao.getSummary).toHaveBeenCalledWith(range);
    expect(result).toEqual({
      totalTokens: 300,
      totalCost: 12.5,
      runCount: 2,
      avgCostPerRun: 6.25,
    });
  });

  it("getDailyCostSeries normalizes daily bucket values", async () => {
    const service = createUsageService({} as never);
    const result = await expectOk(service.getDailyCostSeries(range));

    expect(result).toEqual([
      { date: "2024-01-01", cost: 1.25, tokens: 100 },
      { date: "2024-01-02", cost: 2.75, tokens: 200 },
    ]);
  });

  it("getByPipeline returns ranked pipeline aggregates", async () => {
    const service = createUsageService({} as never);
    const result = await expectOk(service.getByPipeline(range));

    expect(result).toEqual([
      { pipelineId: "pipeline-1", totalTokens: 250, totalCost: 9.5, runCount: 2 },
    ]);
  });

  it("getByAgent returns agent token ranking", async () => {
    const service = createUsageService({} as never);
    const result = await expectOk(service.getByAgent(range));

    expect(result).toEqual([
      {
        agentRuntime: "codex",
        agentId: "agent-1",
        modelId: "gpt-5",
        tokens: 777,
        runCount: 3,
      },
    ]);
  });
});
