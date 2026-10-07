import { describe, expect, it } from "vitest";
import { createSerializeCanvasMutationHelper } from "./serializeCanvasMutation.helper";
describe("serializeCanvasMutation", () => {
  it("preserves sequential Canvas mutations within one pipeline", async () => {
    const serialize = createSerializeCanvasMutationHelper({ canvasMutationQueues: new Map() });
    const order: string[] = [];
    const gateState = { release: () => {} };
    const gate = new Promise<void>((resolve) => {
      gateState.release = resolve;
    });
    const first = serialize("pipeline-1", async () => {
      order.push("first");
      await gate;
    });
    const second = serialize("pipeline-1", async () => {
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first"]);
    gateState.release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
  });
});
