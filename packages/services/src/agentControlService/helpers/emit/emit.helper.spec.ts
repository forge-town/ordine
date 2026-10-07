import { describe, expect, it, vi } from "vitest";
import { createEmitHelper } from "./emit.helper";

describe("emit", () => {
  it("retains the Agent Control contract boundary", async () => {
    const append = vi.fn();
    await createEmitHelper({
      options: {
        runEvents: {
          getRun: vi.fn().mockResolvedValue({ status: "completed", controlMode: true }),
          append,
        },
      },
    } as never)("run-1", { type: "action_started" });
    expect(append).not.toHaveBeenCalled();
  });
});
