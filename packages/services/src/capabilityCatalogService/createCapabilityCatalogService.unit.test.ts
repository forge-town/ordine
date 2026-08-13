import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMcpServerKey,
  buildMcpToolReference,
} from "../connectorsService/buildClaudeMcpInjection";
import { createCapabilityCatalogService } from "./createCapabilityCatalogService";

const connectorsDao = {
  findMany: vi.fn(),
};
const skillsDao = {
  findMany: vi.fn(),
  seedIfEmpty: vi.fn(),
};
const riskOverridesDao = {
  delete: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
};

const dependencies = { connectorsDao, skillsDao, riskOverridesDao };

describe("createCapabilityCatalogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectorsDao.findMany.mockResolvedValue([]);
    skillsDao.findMany.mockResolvedValue([
      {
        id: "skill-1",
        name: "read-repository",
        label: "Read repository",
        description: "Read source files",
        origin: "manual",
        sources: [],
      },
    ]);
    skillsDao.seedIfEmpty.mockResolvedValue(undefined);
    riskOverridesDao.findMany.mockResolvedValue([]);
    riskOverridesDao.delete.mockResolvedValue(undefined);
    riskOverridesDao.upsert.mockResolvedValue({ capabilityId: "builtin:Read" });
  });

  const createService = () =>
    createCapabilityCatalogService({} as never, { dependencies: dependencies as never });

  it("filters the public projection by runtime and kinds", async () => {
    const result = await createService().getMany({
      runtime: "codex",
      kinds: ["skill"],
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([
      expect.objectContaining({ id: "skill:skill-1", kind: "skill", reference: "skill-1" }),
    ]);

    const hermesResult = await createService().getMany({
      runtime: "hermes",
      kinds: ["skill"],
    });
    expect(hermesResult._unsafeUnwrap()).toEqual([]);
  });

  it("sets and clears a risk override", async () => {
    const service = createService();
    const setResult = await service.setRiskTierOverride({
      id: "builtin:Read",
      riskTier: "irreversible",
    });
    expect(setResult._unsafeUnwrap()).toMatchObject({
      riskTier: "irreversible",
      riskTierSource: "override",
      inferredRiskTier: "readonly",
    });
    expect(riskOverridesDao.upsert).toHaveBeenCalledWith("builtin:Read", "irreversible");

    const clearResult = await service.setRiskTierOverride({ id: "builtin:Read", riskTier: null });
    expect(clearResult._unsafeUnwrap()).toMatchObject({
      riskTier: "readonly",
      riskTierSource: "rule",
    });
    expect(riskOverridesDao.delete).toHaveBeenCalledWith("builtin:Read");
  });

  it("validates skill, builtin, and MCP references with structured paths", async () => {
    connectorsDao.findMany.mockResolvedValue([
      {
        id: "github",
        name: "github",
        method: "mcp",
        status: "connected",
        origin: "harvested",
        config: {
          transport: "stdio",
          command: "github-mcp",
          tools: [{ name: "create_issue" }],
        },
      },
    ]);
    const service = createService();
    const createIssueReference = buildMcpToolReference(buildMcpServerKey("github"), "create_issue");

    const valid = await service.validateOperationConfig({
      executor: {
        type: "agent",
        skillId: "skill-1",
        allowedTools: ["Read", createIssueReference],
      },
    });
    expect(valid.isOk()).toBe(true);

    const invalid = await service.validateOperationConfig({
      executor: {
        type: "agent",
        skillId: "missing-skill",
        allowedTools: ["unknown-tool"],
      },
    });
    expect(invalid.isErr()).toBe(true);
    expect(invalid._unsafeUnwrapErr()).toMatchObject({
      name: "CapabilityCatalogValidationError",
      issues: [
        {
          path: "config.executor.skillId",
          reference: "missing-skill",
          expectedKinds: ["skill"],
        },
        {
          path: "config.executor.allowedTools[0]",
          reference: "unknown-tool",
          expectedKinds: ["builtin-tool", "mcp-tool"],
        },
      ],
    });

    const incompatibleRuntime = await service.validateOperationConfig({
      executor: {
        type: "agent",
        agent: "hermes",
        skillId: "skill-1",
      },
    });
    expect(incompatibleRuntime._unsafeUnwrapErr()).toMatchObject({
      issues: [
        {
          path: "config.executor.skillId",
          reference: "skill-1",
          expectedKinds: ["skill"],
          runtime: "hermes",
        },
      ],
    });

    const malformed = await service.validateOperationConfig({
      executor: {
        type: "agent",
        agent: "not-a-runtime",
        allowedTools: [42],
        hiddenToolPermission: "shell",
      },
    });
    expect(malformed._unsafeUnwrapErr()).toMatchObject({
      name: "OperationConfigValidationError",
      issues: expect.arrayContaining([
        expect.objectContaining({ path: "config.executor.agent" }),
        expect.objectContaining({ path: "config.executor.allowedTools[0]" }),
        expect.objectContaining({ path: "config.executor" }),
      ]),
    });

    const missingSourceSkill = await service.validateOperationInput({
      config: {},
      sourceSkillId: "missing-source-skill",
    });
    expect(missingSourceSkill._unsafeUnwrapErr()).toMatchObject({
      name: "CapabilityCatalogValidationError",
      issues: [
        {
          path: "sourceSkillId",
          reference: "missing-source-skill",
          expectedKinds: ["skill"],
        },
      ],
    });

    const validSourceSkill = await service.validateOperationInput({
      config: {},
      sourceSkillId: "skill-1",
    });
    expect(validSourceSkill.isOk()).toBe(true);
  });

  it("fails closed when catalog loading fails", async () => {
    connectorsDao.findMany.mockRejectedValue(new Error("database password leaked"));
    const result = await createService().validateOperationConfig({
      executor: { type: "agent", allowedTools: ["Read"] },
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe("Load capability catalog failed");
    expect(result._unsafeUnwrapErr().message).not.toContain("password");
  });
});
