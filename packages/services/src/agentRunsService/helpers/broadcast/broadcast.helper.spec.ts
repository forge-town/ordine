import { describe, expect, it } from "vitest";
import { createBroadcastHelper } from "./broadcast.helper";

describe("broadcast", () => {
  it("retains the Agent Run boundary contract", async () => {
    const calls: string[] = [];
    const listeners = new Map([
      [
        "run-1",
        new Set([
          () => {
            calls.push("rejected");

            return Promise.reject(new Error("listener failed"));
          },
          () => {
            calls.push("healthy");
          },
        ]),
      ],
    ]);
    await createBroadcastHelper({ listeners } as never)({ runId: "run-1" } as never);
    expect(calls).toEqual(["rejected", "healthy"]);
  });
});
