import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionJobRecord } from "@repo/db-schema";
import type { DbConnection } from "../../types";
import type * as ExecutionDaos from "../../daos/executionDaos";
import { createExecutionJobRepository } from "./executionJobRepository";
import { executionFixture } from "../executionRepository/executionFixtures";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  findJob: vi.fn(),
  findPrepared: vi.fn(),
  findRequest: vi.fn(),
}));
vi.mock("../../daos/executionDaos", async (importOriginal) => ({
  ...(await importOriginal<typeof ExecutionDaos>()),
  createExecutionJobsDao: () => ({ list: mocks.list, findById: mocks.findJob }),
  createExecutionPreparedRunsDao: () => ({ findById: mocks.findPrepared }),
  createExecutionRunRequestsDao: () => ({ findScopedById: mocks.findRequest }),
}));

const setup = () => {
  const fixture = executionFixture();
  const job = {
    id: "job",
    workspaceId: fixture.principal.workspaceId,
    subjectId: fixture.principal.subjectId,
    preparedRunId: fixture.prepared.id,
    runRequestId: "request-row",
  } as ExecutionJobRecord;
  const sameIdentity = (identity: { workspaceId: string; subjectId: string }) =>
    identity.workspaceId === job.workspaceId && identity.subjectId === job.subjectId;
  mocks.list.mockImplementation(async (identity) => (sameIdentity(identity) ? [job] : []));
  mocks.findJob.mockImplementation(async (identity, id) =>
    sameIdentity(identity) && id === job.id ? job : null,
  );
  mocks.findPrepared.mockResolvedValue({
    id: fixture.prepared.id,
    prepared: fixture.prepared,
    contentHash: fixture.prepared.contentHash,
  });
  mocks.findRequest.mockResolvedValue({
    preparedRunId: fixture.prepared.id,
    requestId: fixture.input.requestId,
    input: fixture.input,
  });

  return { ...fixture, job, repository: createExecutionJobRepository({} as DbConnection) };
};
beforeEach(() => {
  vi.clearAllMocks();
});

describe("execution Job summary projection", () => {
  it("uses the verified immutable Pipeline snapshot and linked request instead of authoring metadata", async () => {
    const fixture = setup();
    const snapshotName = fixture.prepared.pipeline.name;
    fixture.pipeline.name = "Renamed current authoring Pipeline";
    fixture.pipeline.revision = 50;
    const result = await fixture.repository.getJobSummary(fixture.principal, fixture.job.id);
    expect(result).toMatchObject({
      pipelineName: snapshotName,
      pipelineRevision: 1,
      requestId: fixture.input.requestId,
      pipelineId: fixture.prepared.pipeline.id,
    });
    expect(mocks.findRequest).toHaveBeenCalledWith(fixture.job, "request-row");
  });

  it.each(["workspaceId", "subjectId"] as const)(
    "does not disclose another %s's jobs or snapshots",
    async (field) => {
      const fixture = setup();
      const foreign = { ...fixture.principal, [field]: "foreign" };
      expect(await fixture.repository.listJobSummaries(foreign)).toEqual([]);
      await expect(fixture.repository.getJobSummary(foreign, fixture.job.id)).rejects.toThrow(
        "Job",
      );
      expect(mocks.findPrepared).not.toHaveBeenCalled();
      expect(mocks.findRequest).not.toHaveBeenCalled();
    },
  );

  it("rejects an altered snapshot without inventing a summary", async () => {
    const fixture = setup();
    fixture.prepared.pipeline.name = "Tampered snapshot";
    await expect(fixture.repository.listJobSummaries(fixture.principal)).rejects.toThrow();
  });

  it("rejects a RunRequest that points at a different frozen revision", async () => {
    const fixture = setup();
    mocks.findRequest.mockResolvedValue({
      preparedRunId: fixture.prepared.id,
      requestId: fixture.input.requestId,
      input: { ...fixture.input, expectedRevision: 99 },
    });
    await expect(
      fixture.repository.getJobSummary(fixture.principal, fixture.job.id),
    ).rejects.toThrow("snapshot identity");
  });
});
