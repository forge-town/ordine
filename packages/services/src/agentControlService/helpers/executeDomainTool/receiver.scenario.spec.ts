import { describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import { createExecuteDomainToolHelper } from "./executeDomainTool.helper";
describe("original object method receiver", () => {
  it("preserves the execution-port object receiver for ordinary injected methods", async () => {
    const receivers: unknown[] = [];
    const execution = {
      runPipeline: async function (this: unknown) {
        receivers.push(this);

        return ok({ jobId: "job-1" });
      },
    };
    const execute = createExecuteDomainToolHelper({
      options: { execution },
      changeSetsDao: { findActive: vi.fn().mockResolvedValue(null) },
    } as never);
    const result = await execute(
      "ordine.prepare_pipeline_run",
      { pipelineId: "pipeline-1", callId: "call-1" },
      "thread-1",
      "action-1",
    );
    expect(result.isOk()).toBe(true);
    expect(receivers).toEqual([execution]);
  });
});
