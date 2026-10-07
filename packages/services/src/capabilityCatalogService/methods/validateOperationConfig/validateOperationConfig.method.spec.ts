import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMcpServerKey,
  buildMcpToolReference,
} from "../../../connectorsService/helpers/buildClaudeMcpInjection";
import { createCapabilityCatalogService } from "../../capabilityCatalog.service";

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
  });
});
