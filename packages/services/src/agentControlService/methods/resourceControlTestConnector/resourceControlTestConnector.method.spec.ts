import { describe, expect, it, vi } from "vitest";
import { createResourceControlTestConnectorMethod } from "./resourceControlTestConnector.method";
import { err } from "neverthrow";

describe("resourceControlTestConnector", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlTestConnectorMethod({
      services: {
        connector: { connect: vi.fn().mockResolvedValue(err(new Error("handshake unavailable"))) },
      },
    } as never)("connector-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("handshake unavailable");
  });
});
