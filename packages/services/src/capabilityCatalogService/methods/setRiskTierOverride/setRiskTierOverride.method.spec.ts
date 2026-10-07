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
});
