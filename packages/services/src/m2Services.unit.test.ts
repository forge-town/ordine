import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "./serviceErrors";

const project = {
  id: "project-1",
  name: "Project",
  description: "",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const message = {
  id: "message-1",
  pipelineId: "pipeline-1",
  role: "user",
  content: "Hello",
  metadata: null,
  phase: null,
  createdAt: new Date(0),
};
const connector = {
  id: "connector-1",
  name: "Connector",
  method: "direct-api",
  status: "needs_setup",
  scopes: null,
  config: {},
  lastSyncAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const pipeline = {
  id: "pipeline-1",
  projectId: null,
  name: "Pipeline",
  description: "",
  status: "draft",
  tags: ["tag"],
  timeoutMs: null,
  nodes: [
    {
      id: "node-1",
      type: "prompt",
      metaType: "object",
      position: { x: 0, y: 0 },
      data: { nodeType: "prompt", label: "Prompt", prompt: "Do it" },
    },
  ],
  edges: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const asset = {
  id: "asset-1",
  pipelineId: "pipeline-1",
  name: "Pipeline",
  description: "",
  snapshotNodes: [],
  snapshotEdges: [],
  inputSlots: [],
  totalRuns: 0,
  successRate: null,
  avgDurationMs: null,
  tags: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const projectsDao = {
  findMany: vi.fn().mockResolvedValue([project]),
  findById: vi.fn().mockResolvedValue(project),
  create: vi.fn().mockResolvedValue(project),
  update: vi.fn().mockResolvedValue(project),
  delete: vi.fn().mockResolvedValue(undefined),
};
const pipelinesDao = {
  findMany: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(pipeline),
};
const conversationMessagesDao = {
  findMany: vi.fn().mockResolvedValue([message]),
  findById: vi.fn().mockResolvedValue(message),
  findManyByPipelineId: vi.fn().mockResolvedValue([message]),
  create: vi.fn().mockResolvedValue(message),
  update: vi.fn().mockResolvedValue(message),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteAll: vi.fn().mockResolvedValue(undefined),
};
const connectorsDao = {
  findMany: vi.fn().mockResolvedValue([connector]),
  findById: vi.fn().mockResolvedValue(connector),
  create: vi.fn().mockResolvedValue(connector),
  update: vi.fn().mockResolvedValue(connector),
  delete: vi.fn().mockResolvedValue(undefined),
};
const pipelineAssetsDao = {
  findMany: vi.fn().mockResolvedValue([asset]),
  findById: vi.fn().mockResolvedValue(asset),
  findManyByPipelineId: vi.fn().mockResolvedValue([asset]),
  create: vi.fn().mockResolvedValue(asset),
  update: vi.fn().mockResolvedValue(asset),
  incrementRunStats: vi.fn().mockResolvedValue(asset),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createConnectorsDao: () => connectorsDao,
  createConversationMessagesDao: () => conversationMessagesDao,
  createPipelineAssetsDao: () => pipelineAssetsDao,
  createPipelinesDao: () => pipelinesDao,
  createProjectsDao: () => projectsDao,
}));

import { createConnectorsService } from "./connectorsService";
import { createConversationMessagesService } from "./conversationMessagesService";
import { createPipelineAssetsService } from "./pipelineAssetsService";
import { createProjectsService } from "./projectsService";

const expectOk = async (resultAsync: unknown) => {
  const result = (await resultAsync) as { isOk(): boolean; value: unknown };
  expect(result.isOk()).toBe(true);

  return result.value;
};

describe("M2 services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsDao.findById.mockResolvedValue(project);
    projectsDao.update.mockResolvedValue(project);
    pipelinesDao.findMany.mockResolvedValue([]);
    pipelinesDao.findById.mockResolvedValue(pipeline);
    conversationMessagesDao.findById.mockResolvedValue(message);
    conversationMessagesDao.update.mockResolvedValue(message);
    connectorsDao.findById.mockResolvedValue(connector);
    connectorsDao.update.mockResolvedValue(connector);
    pipelineAssetsDao.findById.mockResolvedValue(asset);
    pipelineAssetsDao.findManyByPipelineId.mockResolvedValue([asset]);
    pipelineAssetsDao.update.mockResolvedValue(asset);
    pipelineAssetsDao.incrementRunStats.mockResolvedValue(asset);
  });

  it("projectsService covers CRUD and conflict delete", async () => {
    const service = createProjectsService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("project-1"));
    await expectOk(service.create({ id: "project-1", name: "Project" }));
    await expectOk(service.update("project-1", { name: "Updated" }));
    await expectOk(service.delete("project-1"));

    pipelinesDao.findMany.mockResolvedValueOnce([{ ...pipeline, projectId: "project-1" }]);
    const conflict = await service.delete("project-1");
    expect(conflict.isErr()).toBe(true);
    expect(conflict._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
  });

  it("projectsService normalizes a foreign-key violation on delete to ConflictError", async () => {
    projectsDao.delete.mockRejectedValueOnce(
      Object.assign(new Error("violates foreign key constraint"), { code: "23503" }),
    );
    const service = createProjectsService({} as never);
    const result = await service.delete("project-1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
  });

  it("projectsService keeps non-FK delete failures as ServiceError", async () => {
    projectsDao.delete.mockRejectedValueOnce(new Error("connection reset"));
    const service = createProjectsService({} as never);
    const result = await service.delete("project-1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().name).toBe("ServiceError");
  });

  it("projectsService returns NotFoundError when updating a missing project", async () => {
    projectsDao.update.mockResolvedValueOnce(undefined);
    const service = createProjectsService({} as never);
    const result = await service.update("missing", { name: "Missing" });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
  });

  it("conversationMessagesService covers public methods", async () => {
    const service = createConversationMessagesService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("message-1"));
    await expectOk(service.getByPipelineId("pipeline-1", 10));
    await expectOk(
      service.create({
        id: "message-1",
        pipelineId: "pipeline-1",
        role: "user",
        content: "Hello",
      }),
    );
    await expectOk(service.update("message-1", { content: "Updated" }));
    await expectOk(service.delete("message-1"));
  });

  it("conversationMessagesService clearAll wipes history via deleteAll", async () => {
    const service = createConversationMessagesService({} as never);
    await expectOk(service.clearAll());

    expect(conversationMessagesDao.deleteAll).toHaveBeenCalledTimes(1);
  });

  it("connectorsService covers public methods", async () => {
    const service = createConnectorsService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("connector-1"));
    await expectOk(
      service.create({
        id: "connector-1",
        name: "Connector",
        method: "direct-api",
        config: {},
      }),
    );
    await expectOk(service.update("connector-1", { status: "connected" }));
    await expectOk(service.delete("connector-1"));
  });

  it("pipelineAssetsService covers CRUD and run stats", async () => {
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("asset-1"));
    await expectOk(service.getByPipelineId("pipeline-1"));
    await expectOk(
      service.create({
        id: "asset-1",
        pipelineId: "pipeline-1",
        name: "Pipeline",
        snapshotNodes: [],
        snapshotEdges: [],
        tags: [],
      }),
    );
    await expectOk(service.update("asset-1", { name: "Updated" }));
    await expectOk(service.incrementRunStats("asset-1", { success: true, durationMs: 1200 }));
    await expectOk(service.delete("asset-1"));
  });

  it("pipelineAssetsService getUsageCount reports source-pipeline liveness", async () => {
    const service = createPipelineAssetsService({} as never);
    const alive = await expectOk(service.getUsageCount("asset-1"));
    expect(alive).toEqual({ assetId: "asset-1", count: 1 });

    pipelinesDao.findById.mockResolvedValueOnce(undefined);
    const orphaned = await expectOk(service.getUsageCount("asset-1"));
    expect(orphaned).toEqual({ assetId: "asset-1", count: 0 });
  });

  it("pipelineAssetsService re-distillation refreshes the snapshot but preserves manual edits", async () => {
    pipelineAssetsDao.findManyByPipelineId.mockResolvedValueOnce([
      { ...asset, name: "Manually renamed", tags: ["manual"] },
    ]);
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.distillFromPipeline("pipeline-1"));

    const patch = pipelineAssetsDao.update.mock.calls[0]![1];
    expect(patch).toEqual({
      snapshotNodes: pipeline.nodes,
      snapshotEdges: [],
      inputSlots: [{ nodeId: "node-1", label: "Prompt", acceptTypes: ["prompt"] }],
    });
    expect(patch).not.toHaveProperty("name");
    expect(patch).not.toHaveProperty("description");
    expect(patch).not.toHaveProperty("tags");
  });

  it("pipelineAssetsService distills by creating an asset when none exists", async () => {
    pipelineAssetsDao.findManyByPipelineId.mockResolvedValueOnce([]);
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.distillFromPipeline("pipeline-1"));

    expect(pipelineAssetsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineId: "pipeline-1",
        name: "Pipeline",
        tags: ["tag"],
        inputSlots: [{ nodeId: "node-1", label: "Prompt", acceptTypes: ["prompt"] }],
      }),
    );
  });

  it("pipelineAssetsService defaults tags to the pipeline name when the pipeline has none", async () => {
    pipelinesDao.findById.mockResolvedValueOnce({ ...pipeline, tags: [] });
    pipelineAssetsDao.findManyByPipelineId.mockResolvedValueOnce([]);
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.distillFromPipeline("pipeline-1"));

    expect(pipelineAssetsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["Pipeline"] }),
    );
  });

  it("pipelineAssetsService refuses to distill an empty pipeline", async () => {
    pipelinesDao.findById.mockResolvedValueOnce({ ...pipeline, nodes: [] });
    const service = createPipelineAssetsService({} as never);
    const result = await service.distillFromPipeline("pipeline-1");

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ConflictError);
    expect(pipelineAssetsDao.update).not.toHaveBeenCalled();
    expect(pipelineAssetsDao.create).not.toHaveBeenCalled();
  });
});
