import { describe, expect, it, vi } from "vitest";
import { createGetAgentRunsServiceHelper } from "./getAgentRunsService.helper";

describe("getAgentRunsService", () => {
  it("retains the planning and attachment boundary", () => {
    const injected = { cancel: vi.fn() };
    const state = { local: undefined };
    const get = createGetAgentRunsServiceHelper({
      dependencies: { agentRunsService: injected },
      agentRunsServiceState: state,
      db: {},
    } as never);
    expect(get()).toBe(injected);
    expect(get()).toBe(injected);
    expect(state.local).toBeUndefined();
  });
});
