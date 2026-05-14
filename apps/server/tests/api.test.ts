import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok } from "neverthrow";

vi.mock("../src/services.js", () => ({
  pipelinesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pipelineRunnerService: {
    startRun: vi.fn(),
  },
  skillsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    seedIfEmpty: vi.fn(),
  },
  operationsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  jobsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getTracesByJobId: vi.fn(),
    updateStatus: vi.fn(),
  },
  distillationsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    run: vi.fn(),
    delete: vi.fn(),
  },
  listDirectory: vi.fn(),
}));

import { app } from "../src/app.js";
import {
  pipelinesService,
  pipelineRunnerService,
  skillsService,
  operationsService,
  jobsService,
  distillationsService,
  listDirectory,
} from "../src/services.js";

const mockPipelinesService = vi.mocked(pipelinesService);
const mockPipelineRunnerService = vi.mocked(pipelineRunnerService);
const mockSkillsService = vi.mocked(skillsService);
const mockOperationsService = vi.mocked(operationsService);
const mockJobsService = vi.mocked(jobsService);
const mockDistillationsService = vi.mocked(distillationsService);
const mockListDirectory = vi.mocked(listDirectory);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Health ──────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

// ─── Pipelines ───────────────────────────────────────────────────────

describe("Pipelines API", () => {
  const mockPipeline = { id: "pipe-1", name: "Test", nodes: [], edges: [] };

  it("GET /api/pipelines returns list", async () => {
    mockPipelinesService.getAll.mockResolvedValueOnce([mockPipeline] as never);
    const res = await app.request("/api/pipelines");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("pipe-1");
  });

  it("POST /api/pipelines creates pipeline", async () => {
    mockPipelinesService.create.mockResolvedValueOnce(mockPipeline as never);
    const res = await app.request("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", nodes: [], edges: [] }),
    });
    expect(res.status).toBe(201);
    expect(mockPipelinesService.create).toHaveBeenCalledOnce();
  });

  it("GET /api/pipelines/:id returns pipeline", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(mockPipeline as never);
    const res = await app.request("/api/pipelines/pipe-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockPipeline);
  });

  it("GET /api/pipelines/:id returns 404 for missing", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/pipelines/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/pipelines/:id updates pipeline", async () => {
    mockPipelinesService.update.mockResolvedValueOnce({
      ...mockPipeline,
      name: "Updated",
    } as never);
    const res = await app.request("/api/pipelines/pipe-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(200);
    expect(mockPipelinesService.update).toHaveBeenCalledWith("pipe-1", { name: "Updated" });
  });

  it("DELETE /api/pipelines/:id removes pipeline", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(mockPipeline as never);
    mockPipelinesService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/pipelines/pipe-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /api/pipelines/:id returns 404 for missing", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/pipelines/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("PUT /api/pipelines upserts - creates when new", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(null as never);
    mockPipelinesService.create.mockResolvedValueOnce(mockPipeline as never);
    const res = await app.request("/api/pipelines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockPipeline),
    });
    expect(res.status).toBe(201);
    expect(mockPipelinesService.create).toHaveBeenCalledOnce();
  });

  it("PUT /api/pipelines upserts - updates when existing", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(mockPipeline as never);
    mockPipelinesService.update.mockResolvedValueOnce(mockPipeline as never);
    const res = await app.request("/api/pipelines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockPipeline),
    });
    expect(res.status).toBe(200);
    expect(mockPipelinesService.update).toHaveBeenCalledOnce();
  });

  it("POST /api/pipelines/:id/run starts a run", async () => {
    mockPipelinesService.getById.mockResolvedValueOnce(mockPipeline as never);
    mockPipelineRunnerService.startRun.mockResolvedValueOnce(ok({ jobId: "job-1" }) as never);
    const res = await app.request("/api/pipelines/pipe-1/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputPath: "/tmp/test" }),
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ jobId: "job-1" });
  });
});

// ─── Rules ───────────────────────────────────────────────────────────

describe("Skills API", () => {
  const mockSkill = { id: "skill-1", name: "TypeScript", category: "language" };

  it("GET /api/skills returns list", async () => {
    mockSkillsService.seedIfEmpty.mockResolvedValueOnce(undefined as never);
    mockSkillsService.getAll.mockResolvedValueOnce([mockSkill] as never);
    const res = await app.request("/api/skills");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/skills creates skill", async () => {
    mockSkillsService.create.mockResolvedValueOnce(mockSkill as never);
    const res = await app.request("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockSkill),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/skills/:id returns skill", async () => {
    mockSkillsService.getById.mockResolvedValueOnce(mockSkill as never);
    const res = await app.request("/api/skills/skill-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockSkill);
  });

  it("PATCH /api/skills/:id updates skill", async () => {
    mockSkillsService.update.mockResolvedValueOnce({ ...mockSkill, name: "Updated" } as never);
    const res = await app.request("/api/skills/skill-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(200);
    expect(mockSkillsService.update).toHaveBeenCalledWith("skill-1", { name: "Updated" });
  });

  it("DELETE /api/skills/:id removes skill", async () => {
    mockSkillsService.getById.mockResolvedValueOnce(mockSkill as never);
    mockSkillsService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/skills/skill-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /api/skills/:id returns 404 for missing", async () => {
    mockSkillsService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/skills/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ─── Operations ──────────────────────────────────────────────────────

describe("Operations API", () => {
  const mockOp = { id: "op-1", name: "Format Code" };

  it("GET /api/operations returns list", async () => {
    mockOperationsService.getAll.mockResolvedValueOnce([mockOp] as never);
    const res = await app.request("/api/operations");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/operations creates operation", async () => {
    mockOperationsService.create.mockResolvedValueOnce(mockOp as never);
    const res = await app.request("/api/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockOp),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/operations upserts - creates when new", async () => {
    mockOperationsService.getById.mockResolvedValueOnce(null as never);
    mockOperationsService.create.mockResolvedValueOnce(mockOp as never);
    const res = await app.request("/api/operations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockOp),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/operations/:id returns operation", async () => {
    mockOperationsService.getById.mockResolvedValueOnce(mockOp as never);
    const res = await app.request("/api/operations/op-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockOp);
  });

  it("GET /api/operations/:id returns 404 for missing", async () => {
    mockOperationsService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/operations/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/operations/:id updates operation", async () => {
    mockOperationsService.update.mockResolvedValueOnce({ ...mockOp, name: "Updated" } as never);
    const res = await app.request("/api/operations/op-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/operations/:id removes operation", async () => {
    mockOperationsService.getById.mockResolvedValueOnce(mockOp as never);
    mockOperationsService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/operations/op-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /api/operations/:id returns 404 for missing", async () => {
    mockOperationsService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/operations/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ─── Jobs ────────────────────────────────────────────────────────────

describe("Jobs API", () => {
  const mockJob = { id: "job-1", status: "completed", pipelineId: "pipe-1" };

  it("GET /api/jobs returns list", async () => {
    mockJobsService.getAll.mockResolvedValueOnce([mockJob] as never);
    const res = await app.request("/api/jobs");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/jobs creates job", async () => {
    mockJobsService.create.mockResolvedValueOnce(mockJob as never);
    const res = await app.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineId: "pipe-1" }),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/jobs/:id returns job", async () => {
    mockJobsService.getById.mockResolvedValueOnce(mockJob as never);
    const res = await app.request("/api/jobs/job-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockJob);
  });

  it("DELETE /api/jobs/:id removes job", async () => {
    mockJobsService.getById.mockResolvedValueOnce(mockJob as never);
    mockJobsService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/jobs/job-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("GET /api/jobs/:id/traces returns traces", async () => {
    const mockTraces = [{ id: "trace-1", jobId: "job-1" }];
    mockJobsService.getTracesByJobId.mockResolvedValueOnce(mockTraces as never);
    const res = await app.request("/api/jobs/job-1/traces");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("PATCH /api/jobs/:id updates job status", async () => {
    mockJobsService.updateStatus.mockResolvedValueOnce({ ...mockJob, status: "failed" } as never);
    const res = await app.request("/api/jobs/job-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(200);
    expect(mockJobsService.updateStatus).toHaveBeenCalledWith("job-1", "failed", {});
  });

  it("PATCH /api/jobs/:id returns 404 for missing", async () => {
    mockJobsService.updateStatus.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/jobs/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── Distillations ───────────────────────────────────────────────────

describe("Distillations API", () => {
  const mockDistillation = {
    id: "dst-1",
    title: "Distill job failure",
    status: "draft",
    mode: "failure",
  };

  it("GET /api/distillations returns list", async () => {
    mockDistillationsService.getAll.mockResolvedValueOnce([mockDistillation] as never);
    const res = await app.request("/api/distillations");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/distillations creates distillation", async () => {
    mockDistillationsService.create.mockResolvedValueOnce(mockDistillation as never);
    const res = await app.request("/api/distillations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockDistillation),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/distillations/:id returns distillation", async () => {
    mockDistillationsService.getById.mockResolvedValueOnce(mockDistillation as never);
    const res = await app.request("/api/distillations/dst-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockDistillation);
  });

  it("PATCH /api/distillations/:id updates distillation", async () => {
    mockDistillationsService.update.mockResolvedValueOnce({
      ...mockDistillation,
      status: "completed",
    } as never);
    const res = await app.request("/api/distillations/dst-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    expect(res.status).toBe(200);
    expect(mockDistillationsService.update).toHaveBeenCalledWith("dst-1", { status: "completed" });
  });

  it("POST /api/distillations/:id/run executes a distillation", async () => {
    mockDistillationsService.run.mockResolvedValueOnce({
      ...mockDistillation,
      status: "completed",
    } as never);
    const res = await app.request("/api/distillations/dst-1/run", { method: "POST" });

    expect(res.status).toBe(202);
    expect(mockDistillationsService.run).toHaveBeenCalledWith("dst-1");
  });

  it("POST /api/distillations/:id/run returns 404 for missing distillation", async () => {
    mockDistillationsService.run.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/distillations/missing/run", { method: "POST" });

    expect(res.status).toBe(404);
  });

  it("DELETE /api/distillations/:id removes distillation", async () => {
    mockDistillationsService.getById.mockResolvedValueOnce(mockDistillation as never);
    mockDistillationsService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/distillations/dst-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});

// ─── Best Practices ──────────────────────────────────────────────────

describe("Filesystem API", () => {
  it("GET /api/filesystem/browse returns directory listing", async () => {
    mockListDirectory.mockResolvedValueOnce({
      isOk: () => true,
      isErr: () => false,
      value: [{ name: "src", type: "directory" }],
    } as never);
    const res = await app.request("/api/filesystem/browse?path=/tmp");
    expect(res.status).toBe(200);
  });

  it("GET /api/filesystem/browse returns 404 for missing directory", async () => {
    mockListDirectory.mockResolvedValueOnce({
      isOk: () => false,
      isErr: () => true,
      error: { type: "DirectoryNotFound", message: "Not found" },
    } as never);
    const res = await app.request("/api/filesystem/browse?path=/nonexistent");
    expect(res.status).toBe(404);
  });

  it("GET /api/filesystem/tree returns directory tree", async () => {
    mockListDirectory.mockResolvedValueOnce({
      isOk: () => true,
      isErr: () => false,
      value: [{ name: "file.ts", type: "file" }],
    } as never);
    const res = await app.request("/api/filesystem/tree?path=/tmp");
    expect(res.status).toBe(200);
  });

  it("GET /api/filesystem/tree returns 400 without path", async () => {
    const res = await app.request("/api/filesystem/tree");
    expect(res.status).toBe(400);
  });
});
