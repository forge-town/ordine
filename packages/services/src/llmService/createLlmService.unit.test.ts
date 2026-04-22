import { describe, it, expect, vi } from "vitest";
import type { DbConnection } from "@repo/models";

const mockGetModel = vi.hoisted(() => vi.fn().mockReturnValue("mock-model"));
const mockDao = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ defaultApiKey: "key-123", defaultModel: "gpt-4" }),
}));

vi.mock("@repo/agent", () => ({
  getModel: mockGetModel,
}));

vi.mock("@repo/models", () => ({
  createSettingsDao: () => mockDao,
}));

import { createLlmService } from "./createLlmService";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createLlmService", () => {
  it("getSettings returns apiKey and model from dao", async () => {
    const svc = createLlmService(mockDb);
    const settings = await svc.getSettings();
    expect(settings).toEqual({ apiKey: "key-123", model: "gpt-4" });
    expect(mockDao.get).toHaveBeenCalled();
  });

  it("getModel calls agent.getModel with settings resolver", () => {
    const svc = createLlmService(mockDb);
    const result = svc.getModel();
    expect(result).toBe("mock-model");
  });

  it("getModel passes modelOverride", () => {
    mockGetModel.mockClear();
    const svc = createLlmService(mockDb);
    svc.getModel("custom-model");
    expect(mockGetModel).toHaveBeenCalledWith(expect.any(Function), "custom-model");
  });
});
