import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startRun: vi.fn(),
  pauseRun: vi.fn(),
  resumeRun: vi.fn(),
  cancelRun: vi.fn(),
  runNow: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
  getAll: vi.fn(),
}));

vi.mock("../services", () => ({
  jobsService: { create: mocks.create, updateStatus: mocks.updateStatus, getAll: mocks.getAll },
  pipelinesService: {},
  operationsService: {},
  routinesService: { runNow: mocks.runNow },
  pipelineRunnerService: mocks,
  operationRunnerService: { startRun: mocks.startRun },
  canvasExecutionPublisher: {},
  operationExecutionPublisher: {},
}));
vi.mock("@repo/services", () => ({ getProposeProgress: vi.fn(), setProposeProgress: vi.fn() }));
vi.mock("@/integrations/server-env", () => ({ getServerEnv: vi.fn() }));

import { jobsRouter } from "./jobs";
import { operationsRouter } from "./operations";
import { pipelinesRouter } from "./pipelines";
import { routinesRouter } from "./routines";

// Direct callers have paths such as "run", bypassing init.ts's namespaced denylist.
const context = { session: { user: { id: "user-1" } } };
const jobs = jobsRouter.createCaller(context);
const pipelines = pipelinesRouter.createCaller(context);
const operations = operationsRouter.createCaller(context);
const routines = routinesRouter.createCaller(context);

describe("legacy execution handlers without namespaced middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["jobs.create", () => jobs.create(undefined)],
    ["jobs.updateStatus", () => jobs.updateStatus(undefined)],
    ["jobs.pause", () => jobs.pause(undefined)],
    ["jobs.resume", () => jobs.resume(undefined)],
    ["jobs.cancel", () => jobs.cancel(undefined)],
    ["pipelines.run", () => pipelines.run(undefined)],
    ["pipelines.cancel", () => pipelines.cancel(undefined)],
    ["operations.run", () => operations.run(undefined)],
    ["routines.runNow", () => routines.runNow(undefined)],
  ])("disables %s without service calls or legacy input parsing", async (_name, call) => {
    await expect(call()).rejects.toMatchObject({
      code: "NOT_IMPLEMENTED",
      message: expect.stringContaining("NOT_SUPPORTED"),
    });
    for (const serviceCall of Object.values(mocks)) expect(serviceCall).not.toHaveBeenCalled();
  });

  it("keeps historical job reads available", async () => {
    mocks.getAll.mockResolvedValue([{ id: "historical-job" }]);
    await expect(jobs.getMany()).resolves.toEqual([{ id: "historical-job" }]);
  });
});
