import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../src/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import {
  listPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  runPipeline,
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  listOperations,
  getOperation,
  createOperation,
  updateOperation,
  deleteOperation,
  listJobs,
  getJob,
  deleteJob,
  listRecipes,
  createRecipe,
  deleteRecipe,
  listBestPractices,
  getBestPractice,
  createBestPractice,
  updateBestPractice,
  deleteBestPractice,
  importBestPractices,
  browseFilesystem,
} from "../src/commands";
import { api } from "../src/api";

const mockApi = vi.mocked(api);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const mockJsonFile = (data: unknown): void => {
  mockReadFileSync.mockReturnValueOnce(JSON.stringify(data));
};

// ─── Pipelines ───────────────────────────────────────────────────────

describe("listPipelines", () => {
  it("prints pipelines when available", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: "pipe-1",
          name: "Lint Check",
          description: "Runs linting",
          tags: ["lint"],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    } as never);

    await listPipelines();

    expect(mockApi.get).toHaveBeenCalledWith("/api/pipelines");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Pipelines (1)"));
  });

  it("prints message when no pipelines", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listPipelines();

    expect(console.log).toHaveBeenCalledWith("No pipelines found.");
  });

  it("throws on API error", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: false, status: 500, message: "Server error" } as never);

    await expect(listPipelines()).rejects.toThrow("Failed to list pipelines");
  });
});

describe("getPipeline", () => {
  it("prints pipeline JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "pipe-1", name: "Test" } } as never);

    await getPipeline("pipe-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/pipelines/pipe-1");
    expect(console.log).toHaveBeenCalled();
  });
});

describe("createPipeline", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ name: "New Pipeline" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "pipe-new" } } as never);

    await createPipeline("/tmp/pipe.json");

    expect(mockApi.post).toHaveBeenCalledWith("/api/pipelines", { name: "New Pipeline" });
    expect(console.log).toHaveBeenCalledWith("Created pipeline: pipe-new");
  });
});

describe("updatePipeline", () => {
  it("updates pipeline", async () => {
    mockJsonFile({ name: "Updated" });
    mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "pipe-1" } } as never);

    await updatePipeline("pipe-1", "/tmp/pipe.json");

    expect(mockApi.patch).toHaveBeenCalledWith("/api/pipelines/pipe-1", { name: "Updated" });
    expect(console.log).toHaveBeenCalledWith("Updated pipeline: pipe-1");
  });
});

describe("deletePipeline", () => {
  it("deletes pipeline", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deletePipeline("pipe-1");

    expect(mockApi.del).toHaveBeenCalledWith("/api/pipelines/pipe-1");
    expect(console.log).toHaveBeenCalledWith("Deleted pipeline: pipe-1");
  });
});

describe("runPipeline", () => {
  it("triggers a run and polls to completion", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-123" } } as never);
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "job-123",
        status: "done",
        logs: ["step 1"],
        result: { summary: "All good" },
        error: null,
      },
    } as never);

    await runPipeline("pipe-1", { inputPath: "/tmp/src" });

    expect(mockApi.post).toHaveBeenCalledWith("/api/pipelines/pipe-1/run", {
      inputPath: "/tmp/src",
    });
    expect(console.log).toHaveBeenCalledWith("Job created: job-123");
  });

  it("does not poll when follow is false", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-456" } } as never);

    await runPipeline("pipe-1", { follow: false });

    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("throws on API error during run", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: false, status: 404, message: "Not found" } as never);

    await expect(runPipeline("nonexistent", {})).rejects.toThrow("Failed to run pipeline");
  });

  it("throws when job fails", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-fail" } } as never);
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { id: "job-fail", status: "failed", logs: [], result: null, error: "Syntax error" },
    } as never);

    await expect(runPipeline("pipe-1", {})).rejects.toThrow("Pipeline failed");
  });
});

// ─── Rules ───────────────────────────────────────────────────────────

describe("listRules", () => {
  it("prints rules", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [{ id: "r-1", name: "No console" }],
    } as never);

    await listRules();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Rules (1)"));
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listRules();

    expect(console.log).toHaveBeenCalledWith("No rules found.");
  });
});

describe("getRule", () => {
  it("prints rule JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "r-1" } } as never);

    await getRule("r-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/rules/r-1");
  });
});

describe("createRule", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ name: "New Rule" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "r-new" } } as never);

    await createRule("/tmp/rule.json");

    expect(console.log).toHaveBeenCalledWith("Created rule: r-new");
  });
});

describe("updateRule", () => {
  it("updates rule", async () => {
    mockJsonFile({ name: "Updated" });
    mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "r-1" } } as never);

    await updateRule("r-1", "/tmp/rule.json");

    expect(console.log).toHaveBeenCalledWith("Updated rule: r-1");
  });
});

describe("deleteRule", () => {
  it("deletes rule", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteRule("r-1");

    expect(console.log).toHaveBeenCalledWith("Deleted rule: r-1");
  });
});

// ─── Skills ──────────────────────────────────────────────────────────

describe("listSkills", () => {
  it("prints skills", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [{ id: "s-1", name: "TS" }] } as never);

    await listSkills();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Skills (1)"));
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listSkills();

    expect(console.log).toHaveBeenCalledWith("No skills found.");
  });
});

describe("getSkill", () => {
  it("prints skill JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "s-1" } } as never);

    await getSkill("s-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/skills/s-1");
  });
});

describe("createSkill", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ name: "New Skill" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "s-new" } } as never);

    await createSkill("/tmp/skill.json");

    expect(console.log).toHaveBeenCalledWith("Created skill: s-new");
  });
});

describe("updateSkill", () => {
  it("updates skill", async () => {
    mockJsonFile({ name: "Updated" });
    mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "s-1" } } as never);

    await updateSkill("s-1", "/tmp/skill.json");

    expect(console.log).toHaveBeenCalledWith("Updated skill: s-1");
  });
});

describe("deleteSkill", () => {
  it("deletes skill", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteSkill("s-1");

    expect(console.log).toHaveBeenCalledWith("Deleted skill: s-1");
  });
});

// ─── Operations ──────────────────────────────────────────────────────

describe("listOperations", () => {
  it("prints operations", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [{ id: "op-1", name: "Format" }],
    } as never);

    await listOperations();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Operations (1)"));
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listOperations();

    expect(console.log).toHaveBeenCalledWith("No operations found.");
  });
});

describe("getOperation", () => {
  it("prints operation JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "op-1" } } as never);

    await getOperation("op-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/operations/op-1");
  });
});

describe("createOperation", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ name: "New Op" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "op-new" } } as never);

    await createOperation("/tmp/op.json");

    expect(console.log).toHaveBeenCalledWith("Created operation: op-new");
  });
});

describe("updateOperation", () => {
  it("updates operation", async () => {
    mockJsonFile({ name: "Updated" });
    mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "op-1" } } as never);

    await updateOperation("op-1", "/tmp/op.json");

    expect(console.log).toHaveBeenCalledWith("Updated operation: op-1");
  });
});

describe("deleteOperation", () => {
  it("deletes operation", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteOperation("op-1");

    expect(console.log).toHaveBeenCalledWith("Deleted operation: op-1");
  });
});

// ─── Jobs ────────────────────────────────────────────────────────────

describe("listJobs", () => {
  it("prints jobs", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [{ id: "j-1", status: "done", title: "Run" }],
    } as never);

    await listJobs({});

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Jobs (1)"));
  });

  it("filters by status", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listJobs({ status: "running" });

    expect(mockApi.get).toHaveBeenCalledWith("/api/jobs?status=running");
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listJobs({});

    expect(console.log).toHaveBeenCalledWith("No jobs found.");
  });
});

describe("getJob", () => {
  it("prints job JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "j-1" } } as never);

    await getJob("j-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/jobs/j-1");
  });
});

describe("deleteJob", () => {
  it("deletes job", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteJob("j-1");

    expect(console.log).toHaveBeenCalledWith("Deleted job: j-1");
  });
});

// ─── Recipes ─────────────────────────────────────────────────────────

describe("listRecipes", () => {
  it("prints recipes", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [{ id: "rec-1", name: "Review" }],
    } as never);

    await listRecipes();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Recipes (1)"));
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listRecipes();

    expect(console.log).toHaveBeenCalledWith("No recipes found.");
  });
});

describe("createRecipe", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ name: "New Recipe" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "rec-new" } } as never);

    await createRecipe("/tmp/recipe.json");

    expect(console.log).toHaveBeenCalledWith("Created recipe: rec-new");
  });
});

describe("deleteRecipe", () => {
  it("deletes recipe", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteRecipe("rec-1");

    expect(console.log).toHaveBeenCalledWith("Deleted recipe: rec-1");
  });
});

// ─── Best Practices ──────────────────────────────────────────────────

describe("listBestPractices", () => {
  it("prints best practices", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [{ id: "bp-1", title: "Use TS" }],
    } as never);

    await listBestPractices();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Best Practices (1)"));
  });

  it("prints message when empty", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listBestPractices();

    expect(console.log).toHaveBeenCalledWith("No best practices found.");
  });
});

describe("getBestPractice", () => {
  it("prints best practice JSON", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: { id: "bp-1" } } as never);

    await getBestPractice("bp-1");

    expect(mockApi.get).toHaveBeenCalledWith("/api/best-practices/bp-1");
  });
});

describe("createBestPractice", () => {
  it("creates from JSON file", async () => {
    mockJsonFile({ title: "New BP" });
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { id: "bp-new" } } as never);

    await createBestPractice("/tmp/bp.json");

    expect(console.log).toHaveBeenCalledWith("Created best practice: bp-new");
  });
});

describe("updateBestPractice", () => {
  it("updates best practice", async () => {
    mockJsonFile({ title: "Updated" });
    mockApi.patch.mockResolvedValueOnce({ ok: true, data: { id: "bp-1" } } as never);

    await updateBestPractice("bp-1", "/tmp/bp.json");

    expect(console.log).toHaveBeenCalledWith("Updated best practice: bp-1");
  });
});

describe("deleteBestPractice", () => {
  it("deletes best practice", async () => {
    mockApi.del.mockResolvedValueOnce({ ok: true, data: undefined } as never);

    await deleteBestPractice("bp-1");

    expect(console.log).toHaveBeenCalledWith("Deleted best practice: bp-1");
  });
});

describe("importBestPractices", () => {
  it("imports from JSON file", async () => {
    mockJsonFile([{ id: "bp-1", title: "Test" }]);
    mockApi.post.mockResolvedValueOnce({
      ok: true,
      data: { imported: 1, checklistItems: 0, codeSnippets: 0 },
    } as never);

    await importBestPractices("/tmp/bps.json");

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Imported: 1 best practices"));
  });
});

// ─── Filesystem ──────────────────────────────────────────────────────

describe("browseFilesystem", () => {
  it("lists directory entries", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [
        { name: "src", type: "directory" },
        { name: "README.md", type: "file" },
      ],
    } as never);

    await browseFilesystem("/tmp");

    expect(mockApi.get).toHaveBeenCalledWith("/api/filesystem/browse?path=%2Ftmp");
    expect(console.log).toHaveBeenCalledWith("  src/");
    expect(console.log).toHaveBeenCalledWith("  README.md");
  });

  it("prints empty message", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await browseFilesystem();

    expect(console.log).toHaveBeenCalledWith("Empty directory.");
  });
});
