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

  it("maps a missing runtime to the localized setup guidance", () => {
    const error = Object.assign(new Error("No Agent runtime is configured"), {
      code: "PIPELINE_AGENT_RUNTIME_NOT_FOUND",
      status: 409,
    });

    expect(getPipelineAgentErrorMessage(error, t, vi.fn())).toBe(
      "pipelineAgentErrors.runtimeNotFound",
    );
  });

  it("does not misreport a local Agent failure as a network outage", () => {
    const error = Object.assign(new Error("Pipeline agent request failed"), {
      code: "PIPELINE_AGENT_REQUEST_FAILED",
    });

    expect(getPipelineAgentErrorMessage(error, t, vi.fn())).toBe("pipelineAgentErrors.agentFailed");
  });

  it("does not misreport attachment storage failures as Agent failures", () => {
    const error = Object.assign(new Error("Storage unavailable"), {
      code: "PIPELINE_AGENT_ATTACHMENT_UPLOAD_FAILED",
      status: 500,
    });

    expect(getPipelineAgentErrorMessage(error, t, vi.fn())).toBe(
      "pipelineAgentErrors.attachmentUploadFailed",
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
