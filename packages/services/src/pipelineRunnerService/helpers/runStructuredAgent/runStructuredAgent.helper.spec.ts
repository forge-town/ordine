import { beforeEach, describe, expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("../agentRunner/agentRunner.helper", () => ({
  runAgent: async (...arguments_: unknown[]) => run(...arguments_),
}));
import { runStructuredAgent } from "./runStructuredAgent.helper";
const options = {
  agent: "codex" as const,
  systemPrompt: "system",
  userPrompt: "input",
  agentId: "plan",
  logPrefix: "plan",
  maxRetries: 1,
};
describe("runStructuredAgent", () => {
  beforeEach(() => {
    run.mockReset();
  });
  it("returns parsed JSON from valid structured output", async () => {
    run.mockResolvedValue('{"result":"done"}');
    expect(await runStructuredAgent(options)).toEqual({ ok: true, json: { result: "done" } });
  });
  it("preserves provider failures as the public failure result", async () => {
    run.mockRejectedValue(new Error("provider unavailable"));
    expect(await runStructuredAgent(options)).toEqual({
      ok: false,
      code: "AGENT_FAILED",
      detail: "provider unavailable",
    });
  });
  it("returns the output failure contract when a response has no JSON", async () => {
    run.mockResolvedValue("not structured output");
    expect(await runStructuredAgent(options)).toMatchObject({
      ok: false,
      code: "BAD_AGENT_OUTPUT",
    });
  });
});
