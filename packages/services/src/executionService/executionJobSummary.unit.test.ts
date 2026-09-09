import { describe, expect, it, vi } from "vitest";
import { ExecutionJobSummarySchema, ExecutionPrincipalSchema } from "@repo/schemas";
import { createExecutionApiService } from "./createExecutionApiService";

const principal = ExecutionPrincipalSchema.parse({
  workspaceId: "workspace",
  subjectId: "subject",
  scopes: ["execution:read"],
});
const projection = {
  pipelineId: "pipeline",
  pipelineName: "Frozen name",
  pipelineRevision: 4,
  requestId: "11111111-1111-4111-8111-111111111111",
  job: {
    id: "job",
    preparedRunId: "prepared",
    revision: 2,
    state: "waiting_for_input",
    createdAt: new Date("2026-09-08T00:00:00Z"),
    startedAt: null,
    finishedAt: null,
    deadlineAt: null,
    waitingDeadlineAt: null,
    stopReason: null,
    error: null,
    warnings: ["Actual warning"],
    workspaceId: "workspace",
    subjectId: "subject",
    executorId: "private-executor",
  },
};
const setup = () => {
  const jobs = {
    listJobSummaries: vi.fn(async () => [projection]),
    getJobSummary: vi.fn(async () => projection),
  };
  const service = createExecutionApiService({
    jobs: jobs as never,
    repository: {} as never,
    preparation: {} as never,
    artifactStore: {} as never,
  });

  return { jobs, service };
};

describe("execution Job summary API service", () => {
  it("returns validated real state and snapshot fields without private Job data", async () => {
    const { service, jobs } = setup();
    const list = await service.listJobSummaries(principal);
    expect(list.isOk()).toBe(true);
    if (list.isErr()) return;
    expect(ExecutionJobSummarySchema.safeParse(list.value[0]).success).toBe(true);
    expect(list.value[0]).toMatchObject({
      pipelineName: "Frozen name",
      pipelineRevision: 4,
      state: "waiting_for_input",
      warnings: ["Actual warning"],
    });
    expect(list.value[0]).not.toHaveProperty("executorId");
    expect(list.value[0]).not.toHaveProperty("subjectId");
    expect(jobs.listJobSummaries).toHaveBeenCalledWith(principal);
    const single = await service.getJobSummary(principal, "job");
    expect(single.isOk() && single.value).toEqual(list.value[0]);
    expect(jobs.getJobSummary).toHaveBeenCalledWith(principal, "job");
  });

  it("checks execution:read before reading either projection", async () => {
    const { service, jobs } = setup();
    const denied = { ...principal, scopes: [] };
    const list = await service.listJobSummaries(denied);
    const single = await service.getJobSummary(denied, "job");
    expect(list.isErr() && single.isErr()).toBe(true);
    expect(jobs.listJobSummaries).not.toHaveBeenCalled();
    expect(jobs.getJobSummary).not.toHaveBeenCalled();
  });
});
