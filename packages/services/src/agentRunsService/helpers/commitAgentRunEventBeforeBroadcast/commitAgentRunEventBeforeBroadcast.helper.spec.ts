import { describe, expect, it } from "vitest";
import { commitAgentRunEventBeforeBroadcast } from "../..";

describe("Agent Run persistence boundary", () => {
  it("commits an event before any listener can observe it", async () => {
    const order: string[] = [];
    const result = await commitAgentRunEventBeforeBroadcast(
      async () => {
        order.push("committed");

        return { sequence: 9 };
      },
      async (event) => {
        expect(event.sequence).toBe(9);
        order.push("broadcast");
      },
    );

    expect(result).toEqual({ sequence: 9 });
    expect(order).toEqual(["committed", "broadcast"]);
  });
});
