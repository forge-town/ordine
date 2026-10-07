import { describe, expect, it, vi } from "vitest";
const storedConnector = {
  id: "connector-1",
  name: "Local",
  config: {},
  encryptedCredentials: { encrypted: "ciphertext" },
};
const operation = vi.fn().mockResolvedValue(storedConnector);
vi.mock("@repo/models", () => ({ createConnectorsDao: () => ({ findById: operation }) }));
import { createConnectorsService } from "../../connectors.service";
describe("getById", () => {
  it("omits encrypted credentials from the public result", async () => {
    const result = await createConnectorsService({} as never).getById("connector-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ id: "connector-1", name: "Local", config: {} });
  });
  it("retains the cause of persistence errors in ServiceError", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createConnectorsService({} as never).getById("connector-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
  it("reports an absent connector", async () => {
    operation.mockResolvedValueOnce(undefined);
    const result = await createConnectorsService({} as never).getById("connector-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      name: "NotFoundError",
      resource: "Connector",
      id: "connector-1",
    });
  });
});
