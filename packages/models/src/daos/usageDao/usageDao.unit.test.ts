import { describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createUsageDao } from "./usageDao";

const rows = [
  {
    totalTokens: 1200,
    runCount: 3,
    date: "2026-01-01",
    pipelineId: "pipeline-1",
    agentRuntime: "codex",
    agentId: "agent-1",
    modelId: "gpt-5",
    tokens: 1200,
  },
];

const where = vi.fn();
const query = {
  groupBy: vi.fn(),
  orderBy: vi.fn(),
  where,
};
where.mockResolvedValueOnce(rows).mockReturnValue(query);
query.groupBy.mockReturnValue(query);
query.orderBy.mockResolvedValue(rows);
const executor = {
  select: vi.fn(() => ({ from: vi.fn(() => query) })),
} as unknown as DbExecutor;
const dao = createUsageDao(executor);
const range = {
  from: new Date("2026-01-01T00:00:00Z"),
  to: new Date("2026-01-31T23:59:59Z"),
};

describe("UsageDao", () => {
  it("aggregates token usage without reintroducing removed cost storage", async () => {
    await expect(dao.getSummary(range)).resolves.toEqual(rows[0]);
    await expect(dao.getDailyTokenSeries(range)).resolves.toEqual(rows);
    await expect(dao.getByPipeline(range)).resolves.toEqual(rows);
    await expect(dao.getByAgent(range)).resolves.toEqual(rows);

    expect(rows[0]).not.toHaveProperty("totalCost");
    expect(query.groupBy).toHaveBeenCalledTimes(3);
    expect(query.orderBy).toHaveBeenCalledTimes(3);
  });
});
