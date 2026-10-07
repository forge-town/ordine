import { describe, expect, it, vi } from "vitest";
const timestamp = new Date(0);
const storedTemplate = {
  id: "template-1",
  name: "Brief",
  description: null,
  content: "# Brief",
  contentType: "markdown",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const expectedTemplate = {
  id: "template-1",
  name: "Brief",
  description: null,
  content: "# Brief",
  contentType: "markdown",
  meta: { createdAt: timestamp, updatedAt: timestamp },
};
const operation = vi.fn().mockResolvedValue([storedTemplate]);
vi.mock("@repo/models", () => ({
  createOperationOutputItemTemplatesDao: () => ({ findMany: operation }),
}));
import { createOperationOutputItemTemplatesService } from "../../operationOutputItemTemplates.service";
describe("getAll", () => {
  it("returns template content with the public metadata shape", async () => {
    const service = createOperationOutputItemTemplatesService({} as never);
    const result = await service.getAll();
    expect(result).toEqual([expectedTemplate]);
  });
  it("preserves persistence failure rejection", async () => {
    const error = new Error("storage unavailable");
    operation.mockRejectedValueOnce(error);
    const service = createOperationOutputItemTemplatesService({} as never);
    await expect(service.getAll()).rejects.toBe(error);
  });
});
