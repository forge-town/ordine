import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Skill } from "@repo/schemas";

const mockDao = {
  findMany: vi.fn().mockResolvedValue([{ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi.fn().mockResolvedValue({ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }),
  findByName: vi.fn().mockResolvedValue({ id: "sk1", name: "lint", createdAt: new Date(0), updatedAt: new Date(0) }),
  create: vi.fn().mockResolvedValue({ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }),
  update: vi.fn().mockResolvedValue({ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAll delegates to dao.findMany", async () => {
    const svc = createSkillsService({} as never);
    const result = await svc.getAll();
    expect(mockDao.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: "sk1", meta: { createdAt: new Date(0), updatedAt: new Date(0) } }]);
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
      ],
      rationale: "Multi-phase workflow",
    };

    it("returns parsed analysis result on successful agent call", async () => {
      vi.mocked(runAgent).mockResolvedValue(JSON.stringify(validAnalysisResult));
      vi.mocked(extractJsonFromText).mockReturnValue(JSON.stringify(validAnalysisResult));

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("multi-step");
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].name).toBe("Define Structure");
    });

    it("falls back to single-step when agent throws", async () => {
      vi.mocked(runAgent).mockRejectedValue(new Error("Agent failed"));

      const svc = createSkillsService({} as never);
      const result = await svc.analyzeSkill(skill);

      expect(result.skillType).toBe("single-step");
      expect(result.steps[0].name).toBe("Page Structure");
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
