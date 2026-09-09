import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";

vi.mock("../src/api", () => ({
  api: {
    get: vi.fn(),
    getBytes: vi.fn(),
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
  listBestPractices,
  getBestPractice,
  createBestPractice,
  updateBestPractice,
  deleteBestPractice,
  exportBestPractices,
  importBestPractices,
  browseFilesystem,
} from "../src/commands";
import { api } from "../src/api";

const mockApi = vi.mocked(api);
const mockReadFileSync = vi.mocked(readFileSync);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const mockJsonFile = (data: unknown): void => {
  mockReadFileSync.mockReturnValueOnce(JSON.stringify(data));
};

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
