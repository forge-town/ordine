import { describe, expect, it } from "vitest";
import { runAbortable } from "./runAbortable.helper";

describe("runAbortable", () => {
  it("retains the planning and attachment boundary", async () => {
    const controller = new AbortController();
    const result = runAbortable(new Promise<void>(() => undefined), controller.signal, "session-1");
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "PIPELINE_AGENT_CANCELLED" });
    await expect(
      runAbortable(Promise.resolve("done"), new AbortController().signal, "session-2"),
    ).resolves.toBe("done");
  });
});
