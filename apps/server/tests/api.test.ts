import { describe, it, expect, vi, beforeEach } from "vitest";

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
  rulesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  recipesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bestPracticesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  bestPracticesBulkService: {
    exportAsZip: vi.fn(),
  },
  checklistService: {
    getAll: vi.fn(),
    getItemById: vi.fn(),
    getItemsByBestPracticeId: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  },
  codeSnippetsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getByBestPracticeId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  listDirectory: vi.fn(),
}));

import { app } from "../src/app.js";
import {
  pipelinesService,
  pipelineRunnerService,
  rulesService,
  skillsService,
  operationsService,
  jobsService,
  recipesService,
  bestPracticesService,
  bestPracticesBulkService,
  checklistService,
  codeSnippetsService,
  listDirectory,
} from "../src/services.js";

const mockPipelinesService = vi.mocked(pipelinesService);
const mockPipelineRunnerService = vi.mocked(pipelineRunnerService);
const mockRulesService = vi.mocked(rulesService);
const mockSkillsService = vi.mocked(skillsService);
const mockOperationsService = vi.mocked(operationsService);
const mockJobsService = vi.mocked(jobsService);
const mockRecipesService = vi.mocked(recipesService);
const mockBestPracticesService = vi.mocked(bestPracticesService);
const mockBestPracticesBulkService = vi.mocked(bestPracticesBulkService);
const mockChecklistService = vi.mocked(checklistService);
const mockCodeSnippetsService = vi.mocked(codeSnippetsService);
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
    mockPipelineRunnerService.startRun.mockResolvedValueOnce({ jobId: "job-1" } as never);
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

describe("Rules API", () => {
  const mockRule = { id: "rule-1", name: "No console", category: "lint", severity: "warning" };

  it("GET /api/rules returns list", async () => {
    mockRulesService.getAll.mockResolvedValueOnce([mockRule] as never);
    const res = await app.request("/api/rules");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/rules creates rule", async () => {
    mockRulesService.create.mockResolvedValueOnce(mockRule as never);
    const res = await app.request("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockRule),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/rules upserts - creates when new", async () => {
    mockRulesService.getById.mockResolvedValueOnce(null as never);
    mockRulesService.create.mockResolvedValueOnce(mockRule as never);
    const res = await app.request("/api/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockRule),
    });
    expect(res.status).toBe(201);
  });

  it("GET /api/rules/:id returns rule", async () => {
    mockRulesService.getById.mockResolvedValueOnce(mockRule as never);
    const res = await app.request("/api/rules/rule-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockRule);
  });

  it("PATCH /api/rules/:id updates rule", async () => {
    mockRulesService.update.mockResolvedValueOnce({ ...mockRule, name: "Updated" } as never);
    const res = await app.request("/api/rules/rule-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    expect(res.status).toBe(200);
    expect(mockRulesService.update).toHaveBeenCalledWith("rule-1", { name: "Updated" });
  });

  it("GET /api/rules/:id returns 404 for missing", async () => {
    mockRulesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/rules/nonexistent");
    expect(res.status).toBe(404);
  });

  it("DELETE /api/rules/:id removes rule", async () => {
    mockRulesService.getById.mockResolvedValueOnce(mockRule as never);
    mockRulesService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/rules/rule-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });
});

// ─── Skills ──────────────────────────────────────────────────────────

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

// ─── Recipes ─────────────────────────────────────────────────────────

describe("Recipes API", () => {
  const mockRecipe = { id: "recipe-1", name: "Code Review" };

  it("GET /api/recipes returns list", async () => {
    mockRecipesService.getAll.mockResolvedValueOnce([mockRecipe] as never);
    const res = await app.request("/api/recipes");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/recipes creates recipe", async () => {
    mockRecipesService.create.mockResolvedValueOnce(mockRecipe as never);
    const res = await app.request("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockRecipe),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/recipes upserts - creates when new", async () => {
    mockRecipesService.getById.mockResolvedValueOnce(null as never);
    mockRecipesService.create.mockResolvedValueOnce(mockRecipe as never);
    const res = await app.request("/api/recipes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockRecipe),
    });
    expect(res.status).toBe(201);
  });

  it("DELETE /api/recipes/:id removes recipe", async () => {
    mockRecipesService.getById.mockResolvedValueOnce(mockRecipe as never);
    mockRecipesService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/recipes/recipe-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /api/recipes/:id returns 404 for missing", async () => {
    mockRecipesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/recipes/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

// ─── Best Practices ──────────────────────────────────────────────────

describe("Best Practices API", () => {
  const mockBp = { id: "bp-1", title: "Use TypeScript", description: "Always" };

  it("GET /api/best-practices returns list", async () => {
    mockBestPracticesService.getAll.mockResolvedValueOnce([mockBp] as never);
    const res = await app.request("/api/best-practices");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("POST /api/best-practices creates best practice", async () => {
    mockBestPracticesService.create.mockResolvedValueOnce(mockBp as never);
    const res = await app.request("/api/best-practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockBp),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/best-practices upserts - creates when new", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(null as never);
    mockBestPracticesService.create.mockResolvedValueOnce(mockBp as never);
    const res = await app.request("/api/best-practices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockBp),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/best-practices upserts - updates when existing", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(mockBp as never);
    mockBestPracticesService.update.mockResolvedValueOnce(mockBp as never);
    const res = await app.request("/api/best-practices", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockBp),
    });
    expect(res.status).toBe(200);
  });

  it("GET /api/best-practices/:id returns best practice", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(mockBp as never);
    const res = await app.request("/api/best-practices/bp-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockBp);
  });

  it("GET /api/best-practices/:id returns 404 for missing", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/best-practices/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/best-practices/:id updates", async () => {
    mockBestPracticesService.update.mockResolvedValueOnce({ ...mockBp, title: "Updated" } as never);
    const res = await app.request("/api/best-practices/bp-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/best-practices/:id removes", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(mockBp as never);
    mockBestPracticesService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/best-practices/bp-1", { method: "DELETE" });
    expect(res.status).toBe(204);
  });

  it("DELETE /api/best-practices/:id returns 404 for missing", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(null as never);
    const res = await app.request("/api/best-practices/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("GET /api/best-practices/export returns zip", async () => {
    mockBestPracticesBulkService.exportAsZip.mockResolvedValueOnce(
      new Uint8Array([1, 2, 3]) as never,
    );
    const res = await app.request("/api/best-practices/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
  });

  it("POST /api/best-practices/import imports entries", async () => {
    mockBestPracticesService.getById.mockResolvedValueOnce(null as never);
    mockBestPracticesService.create.mockResolvedValueOnce(mockBp as never);
    const res = await app.request("/api/best-practices/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ id: "bp-1", title: "Test", checklistItems: [], codeSnippets: [] }]),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.imported).toBe(1);
  });
});

// ─── Checklist Items ─────────────────────────────────────────────────

describe("Checklist Items API", () => {
  const mockItem = { id: "cl-1", text: "Check types", bestPracticeId: "bp-1" };

  it("GET /api/checklist-items returns items by bestPracticeId", async () => {
    mockChecklistService.getItemsByBestPracticeId.mockResolvedValueOnce([mockItem] as never);
    const res = await app.request("/api/checklist-items?bestPracticeId=bp-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("GET /api/checklist-items returns 400 without bestPracticeId", async () => {
    const res = await app.request("/api/checklist-items");
    expect(res.status).toBe(400);
  });

  it("PUT /api/checklist-items upserts - creates when new", async () => {
    mockChecklistService.getItemById.mockResolvedValueOnce(null as never);
    mockChecklistService.createItem.mockResolvedValueOnce(mockItem as never);
    const res = await app.request("/api/checklist-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockItem),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/checklist-items upserts - updates when existing", async () => {
    mockChecklistService.getItemById.mockResolvedValueOnce(mockItem as never);
    mockChecklistService.updateItem.mockResolvedValueOnce(mockItem as never);
    const res = await app.request("/api/checklist-items", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockItem),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/checklist-items deletes by id query", async () => {
    mockChecklistService.deleteItem.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/checklist-items?id=cl-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: "cl-1" });
  });

  it("DELETE /api/checklist-items returns 400 without id", async () => {
    const res = await app.request("/api/checklist-items", { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});

// ─── Code Snippets ───────────────────────────────────────────────────

describe("Code Snippets API", () => {
  const mockSnippet = { id: "cs-1", code: "console.log()", bestPracticeId: "bp-1" };

  it("GET /api/code-snippets returns snippets by bestPracticeId", async () => {
    mockCodeSnippetsService.getByBestPracticeId.mockResolvedValueOnce([mockSnippet] as never);
    const res = await app.request("/api/code-snippets?bestPracticeId=bp-1");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("GET /api/code-snippets returns 400 without bestPracticeId", async () => {
    const res = await app.request("/api/code-snippets");
    expect(res.status).toBe(400);
  });

  it("PUT /api/code-snippets upserts - creates when new", async () => {
    mockCodeSnippetsService.getById.mockResolvedValueOnce(null as never);
    mockCodeSnippetsService.create.mockResolvedValueOnce(mockSnippet as never);
    const res = await app.request("/api/code-snippets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockSnippet),
    });
    expect(res.status).toBe(201);
  });

  it("PUT /api/code-snippets upserts - updates when existing", async () => {
    mockCodeSnippetsService.getById.mockResolvedValueOnce(mockSnippet as never);
    mockCodeSnippetsService.update.mockResolvedValueOnce(mockSnippet as never);
    const res = await app.request("/api/code-snippets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mockSnippet),
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/code-snippets deletes by id query", async () => {
    mockCodeSnippetsService.delete.mockResolvedValueOnce(undefined as never);
    const res = await app.request("/api/code-snippets?id=cs-1", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: "cs-1" });
  });

  it("DELETE /api/code-snippets returns 400 without id", async () => {
    const res = await app.request("/api/code-snippets", { method: "DELETE" });
    expect(res.status).toBe(400);
  });
});

// ─── Filesystem ──────────────────────────────────────────────────────

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
