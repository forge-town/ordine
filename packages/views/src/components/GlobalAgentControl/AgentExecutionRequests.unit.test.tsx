import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentExecutionRequests } from "./AgentExecutionRequests";

const state = vi.hoisted(() => ({ actions: [] as unknown[] }));
vi.mock("./GlobalAgentControlProvider", () => ({
  useAgentControl: (select: (value: unknown) => unknown) => select(state),
}));
vi.mock("../ExecutionRequest/ExecutionRequestCard", () => ({
  ExecutionRequestCard: ({ requestId }: { requestId: string }) => <div>{requestId}</div>,
}));

describe("Agent execution receipts", () => {
  beforeEach(() => {
    state.actions = [];
  });
  it("does not invent a request from a started or failed tool action", () => {
    state.actions = ["started", "failed"].map((status) => ({
      id: crypto.randomUUID(),
      status,
      toolName: "ordine.prepare_pipeline_run",
    }));
    const { container } = render(<AgentExecutionRequests />);
    expect(container.textContent).toBe("");
  });
  it("uses the acknowledged receipt ID and deduplicates replays", () => {
    const requestId = crypto.randomUUID();
    state.actions = ["succeeded", "replayed"].map((status) => ({
      id: "tool-action",
      status,
      result: {
        data: {
          executionReceipt: {
            apiVersion: 2,
            requestId,
            state: "awaiting_approval",
            preparedRunId: "prepared",
            approvalId: "approval",
            expiresAt: "2026-09-09T12:00:00.000Z",
          },
        },
      },
    }));
    render(<AgentExecutionRequests />);
    expect(screen.getAllByText(requestId)).toHaveLength(1);
  });
});
