import { describe, it, expect, vi } from "vitest";
import { createSettingsService } from "./createSettingsService";

const makeMockDao = () => ({
  get: vi.fn().mockResolvedValue({ llmApiKey: "key", llmModel: "gpt-4" }),
  update: vi.fn().mockResolvedValue({ llmApiKey: "new-key" }),
});

describe("createSettingsService", () => {
  it("get delegates to dao.get", async () => {
    const dao = makeMockDao();
    const svc = createSettingsService(dao as never);
    const result = await svc.get();
    expect(dao.get).toHaveBeenCalled();
    expect(result).toEqual({ llmApiKey: "key", llmModel: "gpt-4" });
  });

  it("update delegates to dao.update", async () => {
    const dao = makeMockDao();
    const svc = createSettingsService(dao as never);
    const data = { llmApiKey: "new-key" } as never;
    await svc.update(data);
    expect(dao.update).toHaveBeenCalledWith(data);
  });
});
