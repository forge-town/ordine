import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbExecutor } from "../../types";
import { createRoutinesDao } from "./routinesDao";

const routine = {
  id: "routine-1",
  pipelineId: "pipeline-1",
  name: "Nightly",
  description: "Runs the nightly pipeline",
  cronExpression: "0 0 * * *",
  inputConfig: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};
const returning = vi.fn(() => Promise.resolve([routine]));
const limit = vi.fn(() => Promise.resolve([routine]));
const orderBy = vi.fn(() => Promise.resolve([routine]));
const where = vi.fn(() => ({ limit, orderBy, returning }));
const from = vi.fn(() => ({ orderBy, where }));
const values = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where }));
const executor = {
  select: vi.fn(() => ({ from })),
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
  delete: vi.fn(() => ({ where })),
} as unknown as DbExecutor;
const dao = createRoutinesDao(executor);

describe("RoutinesDao", () => {
  beforeEach(() => vi.clearAllMocks());

  it("implements CRUD and scheduled-routine reads", async () => {
    await expect(dao.findMany()).resolves.toEqual([routine]);
    await expect(dao.findById(routine.id)).resolves.toEqual(routine);
    await expect(dao.findManyByPipelineId(routine.pipelineId)).resolves.toEqual([routine]);
    await expect(dao.findManyEnabled()).resolves.toEqual([routine]);
    await expect(
      dao.create({
        id: routine.id,
        pipelineId: routine.pipelineId,
        name: routine.name,
        description: routine.description,
        cronExpression: routine.cronExpression,
      }),
    ).resolves.toEqual(routine);
    await expect(dao.update(routine.id, { enabled: false })).resolves.toEqual(routine);
    await expect(
      dao.claimNextRun(
        routine.id,
        new Date("2026-06-10T09:00:00.000Z"),
        new Date("2026-06-10T09:05:00.000Z"),
      ),
    ).resolves.toBe(true);
    await expect(dao.delete(routine.id)).resolves.toBeUndefined();

    expect(limit).toHaveBeenCalledWith(1);
    expect(orderBy).toHaveBeenCalledTimes(3);
  });
});
