import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Skill } from "@repo/schemas";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "sk1" , createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "sk1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  findByName: vi.fn().mockResolvedValue({ id: "sk1", name: "lint" , createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "sk1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "sk1" , createdAt: new Date(0), updatedAt: new Date(0) }),
  delete: vi.fn().mockResolvedValue(undefined),
  seedIfEmpty: vi.fn().mockResolvedValue(undefined),
};

const mockSettingsDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "mastra",
    defaultApiKey: "test-key",
    defaultModel: "test-model",
  }),
};

vi.mock("@repo/models", () => ({
  createSkillsDao: () => mockDao,
  createSettingsDao: () => mockSettingsDao,
}));

vi.mock("../pipelineRunnerService/agentRunner/agentRunner", () => ({
  runAgent: vi.fn(),
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: vi.fn((text: string) => text),
}));

vi.mock("@repo/logger", () => ({
  logger: { error: vi.fn() },
}));

import { createSkillsService } from "./createSkillsService";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { extractJsonFromText } from "@repo/agent";

describe("createSkillsService", () => {
  const tempDir = join(tmpdir(), `ordine-skills-${randomUUID()}`);

  beforeEach(async () => {
    vi.clearAllMocks();
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("getAll delegates to dao.findMany", async () => {
    const svc = createSkillsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sk1" , meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
  });

  it("getById delegates to dao.findById", async () => {
    const svc = createSkillsService({} as never);
    await svc.getById("sk1");
    expect(mockDao.findById).toHaveBeenCalledWith("sk1");
  });

  it("getByName delegates to dao.findByName", async () => {
    const svc = createSkillsService({} as never);
    await svc.getByName("lint");
    expect(mockDao.findByName).toHaveBeenCalledWith("lint");
  });

  it("create delegates to dao.create", async () => {
    const svc = createSkillsService({} as never);
    const data = { name: "skill" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });

  it("update delegates to dao.update", async () => {
    const svc = createSkillsService({} as never);
    await svc.update("sk1", { name: "updated" } as never);
    expect(mockDao.update).toHaveBeenCalledWith("sk1", { name: "updated" });
  });

  it("delete delegates to dao.delete", async () => {
    const svc = createSkillsService({} as never);
    await svc.delete("sk1");
    expect(mockDao.delete).toHaveBeenCalledWith("sk1");
  });

  it("seedIfEmpty delegates to dao.seedIfEmpty", async () => {
    const svc = createSkillsService({} as never);
    await svc.seedIfEmpty();
    expect(mockDao.seedIfEmpty).toHaveBeenCalled();
  });

  it("previewImport scans SKILL.md files into candidates", async () => {
    const skillDir = join(tempDir, "review-code");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: review-code\ndescription: Review code carefully\n---\n\n# Steps\nInspect files.",
    );

    const svc = createSkillsService({} as never);
    const preview = await svc.previewImport({ rootPath: tempDir });

    expect(preview.errors).toEqual([]);
    expect(preview.candidates).toEqual([
      expect.objectContaining({
        id: "imported-review-code",
        name: "review-code",
        label: "Review Code",
        description: "Review code carefully",
      }),
    ]);
  });

  it("importCandidates creates missing skills", async () => {
    mockDao.findByName.mockResolvedValueOnce(undefined);
    const svc = createSkillsService({} as never);

    await svc.importCandidates([
      {
        id: "imported-review-code",
        name: "review-code",
        label: "Review Code",
        description: "Review code carefully",
        path: join(tempDir, "review-code", "SKILL.md"),
      },
    ]);

    expect(mockDao.create).toHaveBeenCalledWith({
      id: "imported-review-code",
      name: "review-code",
      label: "Review Code",
      description: "Review code carefully",
      category: "imported",
      tags: ["imported"],
    });
  });

  describe("analyzeSkill", () => {
    const skill = {
      id: "skill-001",
      label: "Page Structure",
      description: "Generate standard page anatomy.",
    } as unknown as Skill;

    const validAnalysisResult = {
      skillType: "multi-step",
      steps: [
        {
          name: "Define Structure",
          description: "Define page structure.",
          suggestedOutputs: [],
        },
        {
          name: "Implement Components",
          description: "Build UI components.",
          suggestedOutputs: [],
        },
      ],
      rationale: "Multi-phase workflow",
    };

    it("returns parsed analysis result on successful agent call", async () => {
      vi.mocked(runAgent).mockResolvedValue(JSON.stringify(validAnalysisResult));
      vi.mocked(extractJsonFromText).mockReturnValue(JSON.stringify(validAnalysisResult));

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("multi-step");
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]!.name).toBe("Define Structure");
    });

    it("falls back to single-step when agent throws", async () => {
      vi.mocked(runAgent).mockRejectedValue(new Error("Agent failed"));

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("single-step");
      expect(result.steps[0]!.name).toBe("Page Structure");
    });

    it("falls back to single-step when agent output is invalid JSON", async () => {
      vi.mocked(runAgent).mockResolvedValue("not-json");
      vi.mocked(extractJsonFromText).mockReturnValue("not-json");

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("single-step");
    });

    it("falls back to single-step when parsed JSON fails schema validation", async () => {
      vi.mocked(runAgent).mockResolvedValue(JSON.stringify({ invalid: true }));
      vi.mocked(extractJsonFromText).mockReturnValue(JSON.stringify({ invalid: true }));

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("single-step");
    });
  });
});
