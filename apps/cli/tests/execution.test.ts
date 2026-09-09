import { describe, expect, it, vi } from "vitest";
import { OperationRevisionSchema, PipelineDefinitionSchema } from "@repo/schemas";
import { findExecutionAction } from "../src/execution";
import { job, event } from "./fixtures/execution";
import { api } from "../src/api";

const operation = OperationRevisionSchema.parse({
  apiVersion: 2,
  id: "operation-1",
  revision: 1,
  name: "Identity",
  inputPorts: [],
  outputPorts: [],
  executor: { kind: "builtin", name: "identity" },
});
const pipeline = PipelineDefinitionSchema.parse({
  apiVersion: 2,
  id: "pipeline-1",
  revision: 1,
  name: "Pipeline",
  graph: {
    schemaVersion: 2,
    inputs: [],
    nodes: [{ id: "node-1", operation: { operationId: operation.id, revision: 1 } }],
    edges: [],
    outputs: [],
  },
});
const asset = {
  artifactId: "asset-1",
  subjectId: "subject-1",
  workspaceId: "workspace-1",
  name: "input.txt",
  mimeType: "text/plain",
  sizeBytes: 1,
  sha256: "a".repeat(64),
  createdAt: "2026-09-08T12:00:00Z",
};
const artifact = {
  artifactId: "artifact-1",
  jobId: "job-1",
  nodeId: "node-1",
  portId: "output",
  attemptId: "attempt-1",
  name: "output.txt",
  mimeType: "text/plain",
  sizeBytes: 1,
  sha256: "b".repeat(64),
  state: "published",
  createdAt: "2026-09-08T12:00:00Z",
};
const client = () => ({
  get: vi.fn<typeof api.get>(),
  post: vi.fn<typeof api.post>(),
  put: vi.fn<typeof api.put>(),
  getBytes: vi.fn<typeof api.getBytes>(),
});

describe("execution v2 definitions and artifacts", () => {
  it("saves operations with CAS using the immutable operation ID", async () => {
    const fake = client();
    fake.put.mockResolvedValue({ ok: true, data: operation });
    const body = { apiVersion: 2, expectedRevision: 0, operation };
    expect(await findExecutionAction("operations.save")!.call(body, fake)).toEqual(operation);
    expect(fake.put).toHaveBeenCalledWith("/api/v2/operations/operation-1", body);
  });
  it("saves pipeline content with matching path identity and expected revision", async () => {
    const fake = client();
    fake.put.mockResolvedValue({ ok: true, data: pipeline });
    const { apiVersion, id, revision: _, ...definition } = pipeline;
    const body = { apiVersion, pipelineId: id, expectedRevision: 0, definition };
    expect(await findExecutionAction("pipelines.save")!.call(body, fake)).toEqual(pipeline);
    expect(fake.put).toHaveBeenCalledWith("/api/v2/pipelines/pipeline-1", body);
  });
  it.each([
    ["jobs.list", {}, "/api/v2/jobs", [job]],
    ["jobs.get", { jobId: job.id }, "/api/v2/jobs/job-1", job],
    [
      "jobs.events",
      { jobId: job.id },
      "/api/v2/jobs/job-1/events?afterSequence=0&limit=100",
      [event],
    ],
    [
      "jobs.result",
      { jobId: job.id },
      "/api/v2/jobs/job-1/result",
      { jobId: job.id, state: "succeeded", outputs: {}, artifacts: [], warnings: [] },
    ],
    ["operations.list", {}, "/api/v2/operations", [operation]],
    ["pipelines.list", {}, "/api/v2/pipelines", [pipeline]],
    ["pipelines.get", { id: "pipeline-1" }, "/api/v2/pipelines/pipeline-1", pipeline],
    ["jobs.artifacts", { jobId: "job-1" }, "/api/v2/jobs/job-1/artifacts", [artifact]],
    ["artifacts.get", { id: "artifact-1" }, "/api/v2/artifacts/artifact-1", artifact],
    ["artifacts.get", { id: "asset-1" }, "/api/v2/artifacts/asset-1", asset],
  ])("validates %s response without a legacy data envelope", async (name, input, path, value) => {
    const fake = client();
    fake.get.mockResolvedValue({ ok: true, data: value });
    expect(await findExecutionAction(name as string)!.call(input, fake)).toEqual(value);
    expect(fake.get).toHaveBeenCalledWith(path);
    fake.get.mockResolvedValue({ ok: true, data: { data: value } });
    await expect(findExecutionAction(name as string)!.call(input, fake)).rejects.toThrow();
  });
  it("imports exact explicit file content with stable import identity", async () => {
    const fake = client();
    fake.post.mockResolvedValue({ ok: true, data: asset });
    const body = {
      importRequestId: "11111111-1111-4111-8111-111111111111",
      name: "input.txt",
      mimeType: "text/plain",
      contentBase64: "eA==",
    };
    expect(await findExecutionAction("input_assets.import")!.call(body, fake)).toEqual(asset);
    expect(fake.post).toHaveBeenCalledWith("/api/v2/input-assets", body);
  });
  it("rejects old operation/pipeline documents and revisions before saving", async () => {
    const fake = client();
    await expect(
      findExecutionAction("operations.save")!.call({ name: "old", config: {} }, fake),
    ).rejects.toThrow();
    await expect(
      findExecutionAction("pipelines.save")!.call(
        { apiVersion: 2, pipelineId: pipeline.id, expectedRevision: -1, definition: {} },
        fake,
      ),
    ).rejects.toThrow();
    expect(fake.put).not.toHaveBeenCalled();
  });
});
