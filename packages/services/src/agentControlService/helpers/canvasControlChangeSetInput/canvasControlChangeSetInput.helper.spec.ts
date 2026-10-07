import { describe, expect, it } from "vitest";
import { changeSetInput } from "./canvasControlChangeSetInput.helper";

describe("canvasControlChangeSetInput", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(
      changeSetInput({
        pipelineId: "pipeline-1",
        threadId: "thread-1",
        callId: "call-1",
        changeSetId: "change-1",
      } as never),
    ).toMatchObject({ pipelineId: "pipeline-1", callId: "call-1", changeSetId: "change-1" });
  });
});
