import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDao = {
  findMany: vi
    .fn()
    .mockResolvedValue([{ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }]),
  findById: vi
    .fn()
    .mockResolvedValue({ id: "sk1", createdAt: new Date(0), updatedAt: new Date(0) }),
  findByName: vi
    .fn()
    .mockResolvedValue({ id: "sk1", name: "lint", createdAt: new Date(0), updatedAt: new Date(0) }),
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

vi.mock("../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper", () => ({
  runAgent: vi.fn(),
}));

vi.mock("@repo/agent", () => ({
  extractJsonFromText: vi.fn((text: string) => text),
}));

vi.mock("@repo/logger", () => ({
  logger: { error: vi.fn() },
}));

import { createSkillsService } from "../../skills.service";

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

  it("create delegates to dao.create", async () => {
    const svc = createSkillsService({} as never);
    const data = { name: "skill" } as never;
    await svc.create(data);
    expect(mockDao.create).toHaveBeenCalledWith(data);
  });
});
