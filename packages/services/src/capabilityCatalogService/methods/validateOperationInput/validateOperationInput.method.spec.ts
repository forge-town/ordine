import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("validates source skill references with structured input paths", async () => {
    const service = createService();
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
});
