import { afterEach, describe, expect, it, vi } from "vitest";
import { agentEngine } from "@repo/agent-engine";
import { configureAgentRunController } from "./configureAgentRunController.helper";
describe("configureAgentRunController", () => {
  afterEach(() => configureAgentRunController(null));
  it("configures the package-local engine that service callers actually execute", async () => {
    configureAgentRunController(
      vi.fn().mockResolvedValue({ text: "configured execution", usage: null }),
    );
    expect(await agentEngine.run({} as never)).toEqual({
      text: "configured execution",
      usage: null,
    });
  });
});
