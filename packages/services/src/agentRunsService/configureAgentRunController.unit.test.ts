import { describe, expect, it, vi } from "vitest";
import { agentEngine } from "@repo/agent-engine";
import { configureAgentRunController } from "./configureAgentRunController";

vi.mock("@repo/agent-engine", () => ({
  agentEngine: { setRunController: vi.fn() },
}));

describe("configureAgentRunController", () => {
  it("configures the Agent Engine instance owned by the services package", () => {
    const controller = vi.fn();

    configureAgentRunController(controller);

    expect(agentEngine.setRunController).toHaveBeenCalledWith(controller);
  });
});
