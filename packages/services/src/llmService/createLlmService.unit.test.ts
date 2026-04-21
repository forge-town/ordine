import { describe, it, expect, vi } from "vitest";

const mockGetModel = vi.hoisted(() => vi.fn().mockReturnValue("mock-model"));
const mockDao = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ llmApiKey: "key-123", llmModel: "gpt-4" }),
}));

vi.mock("@repo/agent", () => ({
  getModel: mockGetModel,
}));

vi.mock("@repo/models", () => ({
  createSettingsDao: () => mockDao,
}));

import { createLlmService } from "./createLlmService";

describe("createLlmService", () => {
  it("getSettings returns apiKey and model from dao", async () => {
    const svc = createLlmService({} as never);
    const settings = await svc.getSettings();
    expect(settings).toEqual({ apiKey: "key-123", model: "gpt-4" });
    expect(mockDao.get).toHaveBeenCalled();
  });

  it("getModel calls agent.getModel with settings resolver", () => {
    const svc = createLlmService({} as never);
    const result = svc.getModel();
    expect(result).toBe("mock-model");
  });

  it("getModel passes modelOverride", () => {
    mockGetModel.mockClear();
    const svc = createLlmService({} as never);
    svc.getModel("custom-model");
    expect(mockGetModel).toHaveBeenCalledWith(expect.any(Function), "custom-model");
  });
});
