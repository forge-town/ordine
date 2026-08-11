import { describe, expect, it, vi } from "vitest";
import { getPipelineAgentErrorMessage } from "./pipelineAgentErrorMessage";

const t = (key: string) => key;

describe("getPipelineAgentErrorMessage", () => {
  it("maps stable server codes without exposing the raw error", () => {
    const error = Object.assign(new Error("raw schema diagnostics"), {
      code: "PIPELINE_AGENT_INVALID_STRUCTURE",
      status: 500,
    });

    expect(getPipelineAgentErrorMessage(error, t, vi.fn())).toBe(
      "pipelineAgentErrors.invalidStructure",
    );
  });

  it("maps network failures and logs the original error", () => {
    const error = new TypeError("fetch failed");
    const logError = vi.fn();

    expect(getPipelineAgentErrorMessage(error, t, logError)).toBe("pipelineAgentErrors.network");
    expect(logError).toHaveBeenCalledWith("Pipeline Agent request failed", error);
  });

  it("treats an intentional cancellation as a normal state transition", () => {
    const error = new DOMException("The operation was aborted", "AbortError");
    const logError = vi.fn();

    expect(getPipelineAgentErrorMessage(error, t, logError)).toBe("pipelineAgentErrors.cancelled");
    expect(logError).not.toHaveBeenCalled();
  });
});
