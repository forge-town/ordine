import { describe, expect, it } from "vitest";
import { createCanvasControlValidateSnapshotHelper } from "./canvasControlValidateSnapshot.helper";

describe("canvasControlValidateSnapshot", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlValidateSnapshotHelper({} as never)(
      { nodes: "invalid", edges: [] } as never,
      "action-1",
    );
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "INVALID_CANVAS", retryable: true });
  });
});
