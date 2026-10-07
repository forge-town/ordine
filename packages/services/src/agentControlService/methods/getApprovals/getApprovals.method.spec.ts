import { describe, expect, it } from "vitest";
import { createGetApprovalsMethod } from "./getApprovals.method";

describe("getApprovals", () => {
  it("retains the Agent Control contract boundary", async () => {
    const order: string[] = [];
    const get = createGetApprovalsMethod({
      approvalsDao: {
        expirePending: async () => {
          order.push("expire");
        },
        findManyByThreadId: async () => {
          order.push("read");

          return [];
        },
      },
    } as never);
    expect(await get("thread-1")).toEqual([]);
    expect(order).toEqual(["expire", "read"]);
  });
});
