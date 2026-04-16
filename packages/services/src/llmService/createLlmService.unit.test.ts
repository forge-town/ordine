import { describe, it, expect, vi } from "vitest";

const mockGetModel = vi.hoisted(() => vi.fn().mockReturnValue("mock-model"));

vi.mock("@repo/agent", () => ({
  getModel: mockGetModel,
}));

import { createLlmService } from "./createLlmService";

const makeMockDao = () => ({
  get: vi.fn().mockResolvedValue({ llmApiKey: "key-123", llmModel: "gpt-4" }),
});

describe("createLlmService", () => {
  it("getSettings returns apiKey and model from dao", async () => {
    const dao = makeMockDao();
    const svc = createLlmService(dao as never);
    const settings = await svc.getSettings();
    expect(settings).toEqual({ apiKey: "key-123", model: "gpt-4" });
    expect(dao.get).toHaveBeenCalled();
  });

  it("getModel calls agent.getModel with settings resolver", () => {
    const dao = makeMockDao();
    const svc = createLlmService(dao as never);
    const result = svc.getModel();
    expect(result).toBe("mock-model");
  });

  it("getModel passes modelOverride", () => {
    mockGetModel.mockClear();
    const dao = makeMockDao();
    const svc = createLlmService(dao as never);
    svc.getModel("custom-model");
    expect(mockGetModel).toHaveBeenCalledWith(expect.any(Function), "custom-model");
  });
});
