import { describe, expect, it, vi } from "vitest";
const operation = vi.fn().mockResolvedValue(undefined);
vi.mock("@repo/models", () => ({
  createOperationOutputItemTemplatesDao: () => ({ delete: operation }),
}));
import { createOperationOutputItemTemplatesService } from "../../operationOutputItemTemplates.service";
describe("delete", () => {
  it("completes deletion without returning a stored record", async () => {
    const service = createOperationOutputItemTemplatesService({} as never);
    const result = await service.delete("template-1");
    expect(result).toEqual(undefined);
  });
  it("preserves persistence failure rejection", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createOperationOutputItemTemplatesService({} as never);
    await expect(service.delete("template-1")).rejects.toBe(error);
  });
});
