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
const annotation = {
  id: "annotation-1",
  pipelineId: "pipeline-1",
  targetId: "node-1",
  targetType: "node",
  author: "user",
  content: "Note",
  resolved: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const routine = {
  id: "routine-1",
  pipelineId: "pipeline-1",
  name: "Routine",
  triggerType: "cron",
  cronExpression: "* * * * *",
  eventType: null,
  eventConfig: null,
  inputConfig: null,
  enabled: true,
  lastRunAt: null,
  nextRunAt: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
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
  getAll: vi.fn().mockResolvedValue([project]),
  getById: vi.fn().mockResolvedValue(project),
  create: vi.fn().mockResolvedValue(project),
  update: vi.fn().mockResolvedValue(project),
  delete: vi.fn().mockResolvedValue(undefined),
};
const pipelinesDao = {
  findMany: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(pipeline),
};
const conversationMessagesDao = {
  getAll: vi.fn().mockResolvedValue([message]),
  getById: vi.fn().mockResolvedValue(message),
  getByPipelineId: vi.fn().mockResolvedValue([message]),
  create: vi.fn().mockResolvedValue(message),
  update: vi.fn().mockResolvedValue(message),
  delete: vi.fn().mockResolvedValue(undefined),
};
const annotationsDao = {
  getAll: vi.fn().mockResolvedValue([annotation]),
  getById: vi.fn().mockResolvedValue(annotation),
  getByPipelineId: vi.fn().mockResolvedValue([annotation]),
  getByTargetId: vi.fn().mockResolvedValue([annotation]),
  create: vi.fn().mockResolvedValue(annotation),
  update: vi.fn().mockResolvedValue(annotation),
  delete: vi.fn().mockResolvedValue(undefined),
};
const routinesDao = {
  getAll: vi.fn().mockResolvedValue([routine]),
  getById: vi.fn().mockResolvedValue(routine),
  getByPipelineId: vi.fn().mockResolvedValue([routine]),
  getEnabled: vi.fn().mockResolvedValue([routine]),
  create: vi.fn().mockResolvedValue(routine),
  update: vi.fn().mockResolvedValue(routine),
  delete: vi.fn().mockResolvedValue(undefined),
};
const connectorsDao = {
  getAll: vi.fn().mockResolvedValue([connector]),
  getById: vi.fn().mockResolvedValue(connector),
  create: vi.fn().mockResolvedValue(connector),
  update: vi.fn().mockResolvedValue(connector),
  delete: vi.fn().mockResolvedValue(undefined),
};
const pipelineAssetsDao = {
  getAll: vi.fn().mockResolvedValue([asset]),
  getById: vi.fn().mockResolvedValue(asset),
  getByPipelineId: vi.fn().mockResolvedValue([asset]),
  create: vi.fn().mockResolvedValue(asset),
  update: vi.fn().mockResolvedValue(asset),
  incrementRunStats: vi.fn().mockResolvedValue(asset),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@repo/models", () => ({
  createAnnotationsDao: () => annotationsDao,
  createConnectorsDao: () => connectorsDao,
  createConversationMessagesDao: () => conversationMessagesDao,
  createPipelineAssetsDao: () => pipelineAssetsDao,
  createPipelinesDao: () => pipelinesDao,
  createProjectsDao: () => projectsDao,
  createRoutinesDao: () => routinesDao,
}));

import { createAnnotationsService } from "./annotationsService";
import { createConnectorsService } from "./connectorsService";
import { createConversationMessagesService } from "./conversationMessagesService";
import { createPipelineAssetsService } from "./pipelineAssetsService";
import { createProjectsService } from "./projectsService";
import { createRoutinesService } from "./routinesService";

const expectOk = async (resultAsync: unknown) => {
  const result = (await resultAsync) as { isOk(): boolean; value: unknown };
  expect(result.isOk()).toBe(true);

  return result.value;
};

describe("M2 services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsDao.getById.mockResolvedValue(project);
    projectsDao.update.mockResolvedValue(project);
    pipelinesDao.findMany.mockResolvedValue([]);
    pipelinesDao.findById.mockResolvedValue(pipeline);
    conversationMessagesDao.getById.mockResolvedValue(message);
    conversationMessagesDao.update.mockResolvedValue(message);
    annotationsDao.getById.mockResolvedValue(annotation);
    annotationsDao.update.mockResolvedValue(annotation);
    routinesDao.getById.mockResolvedValue(routine);
    routinesDao.update.mockResolvedValue(routine);
    connectorsDao.getById.mockResolvedValue(connector);
    connectorsDao.update.mockResolvedValue(connector);
    pipelineAssetsDao.getById.mockResolvedValue(asset);
    pipelineAssetsDao.getByPipelineId.mockResolvedValue([asset]);
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

  it("annotationsService covers public methods", async () => {
    const service = createAnnotationsService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("annotation-1"));
    await expectOk(service.getByPipelineId("pipeline-1"));
    await expectOk(service.getByTargetId("node-1"));
    await expectOk(
      service.create({
        id: "annotation-1",
        pipelineId: "pipeline-1",
        targetId: "node-1",
        targetType: "node",
        author: "user",
        content: "Note",
      }),
    );
    await expectOk(service.update("annotation-1", { resolved: true }));
    await expectOk(service.delete("annotation-1"));
  });

  it("routinesService covers public methods", async () => {
    const service = createRoutinesService({} as never);
    await expectOk(service.getAll());
    await expectOk(service.getById("routine-1"));
    await expectOk(service.getByPipelineId("pipeline-1"));
    await expectOk(service.getEnabled());
    await expectOk(
      service.create({
        id: "routine-1",
        pipelineId: "pipeline-1",
        name: "Routine",
        triggerType: "cron",
      }),
    );
    await expectOk(service.update("routine-1", { enabled: false }));
    await expectOk(service.delete("routine-1"));
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
    await expectOk(service.getUsageCount("asset-1"));
    await expectOk(
      service.create({
        id: "asset-1",
        pipelineId: "pipeline-1",
        name: "Pipeline",
        snapshotNodes: [],
        snapshotEdges: [],
      }),
    );
    await expectOk(service.update("asset-1", { name: "Updated" }));
    await expectOk(service.incrementRunStats("asset-1", { success: true, durationMs: 1200 }));
    await expectOk(service.delete("asset-1"));
  });

  it("pipelineAssetsService distills from pipeline by updating existing asset", async () => {
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.distillFromPipeline("pipeline-1"));

    expect(pipelineAssetsDao.update).toHaveBeenCalledWith(
      "asset-1",
      expect.objectContaining({
        name: "Pipeline",
        snapshotNodes: pipeline.nodes,
        snapshotEdges: [],
        inputSlots: [{ nodeId: "node-1", label: "Prompt", acceptTypes: ["prompt"] }],
      }),
    );
  });

  it("pipelineAssetsService distills by creating an asset when none exists", async () => {
    pipelineAssetsDao.getByPipelineId.mockResolvedValueOnce([]);
    const service = createPipelineAssetsService({} as never);
    await expectOk(service.distillFromPipeline("pipeline-1"));

    expect(pipelineAssetsDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        pipelineId: "pipeline-1",
        name: "Pipeline",
        inputSlots: [{ nodeId: "node-1", label: "Prompt", acceptTypes: ["prompt"] }],
      }),
    );
  });
});
