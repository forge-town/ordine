import { describe, expect, it, vi } from "vitest";
const storedConnector = {
  id: "connector-1",
  name: "Local",
  config: {},
  encryptedCredentials: { encrypted: "ciphertext" },
};
const operation = vi.fn().mockResolvedValue([storedConnector]);
vi.mock("@repo/models", () => ({ createConnectorsDao: () => ({ findMany: operation }) }));
import { createConnectorsService } from "../../connectors.service";
describe("getAll", () => {
  it("omits encrypted credentials from the public result", async () => {
    const result = await createConnectorsService({} as never).getAll();
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ id: "connector-1", name: "Local", config: {} }]);
  });
  it("retains the cause of persistence errors in ServiceError", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createConnectorsService({} as never).getAll();
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
