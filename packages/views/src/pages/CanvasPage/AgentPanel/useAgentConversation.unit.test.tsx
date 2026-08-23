import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect, useState, type ReactNode } from "react";
import { render } from "../../../test/test-wrapper";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import type { PipelineAgentPlanEvent } from "../../../lib/pipelineAgentSessionsClient";
import { AgentBarStoreProvider, useAgentBarStoreApi } from "./_store";
import { useAgentConversation } from "./useAgentConversation";

const mocks = vi.hoisted(() => ({
  appendMessage: vi.fn(),
  approveProposal: vi.fn(),
  createSession: vi.fn(),
  generatePipelineFromApprovedProposal: vi.fn(),
  getLatestAssistantQuestion: vi.fn(),
  getLatestReadyProposal: vi.fn(),
  isHistoryLoading: false,
  planSessionStream: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../lib/pipelineAgentSessionsClient", () => ({
  createPipelineAgentSessionsClient: () => ({
    appendMessage: (...args: unknown[]) => mocks.appendMessage(...args),
    approveProposal: (...args: unknown[]) => mocks.approveProposal(...args),
    createSession: (...args: unknown[]) => mocks.createSession(...args),
    getLatestAssistantQuestion: (...args: unknown[]) => mocks.getLatestAssistantQuestion(...args),
    getLatestReadyProposal: (...args: unknown[]) => mocks.getLatestReadyProposal(...args),
    generatePipelineFromApprovedProposal: (...args: unknown[]) =>
      mocks.generatePipelineFromApprovedProposal(...args),
    planSessionStream: (...args: unknown[]) => mocks.planSessionStream(...args),
    supersedeProposal: vi.fn(),
  }),
}));

vi.mock("./useAgentConversationPersistence", () => ({
  useAgentConversationPersistence: () => ({
    isLoading: mocks.isHistoryLoading,
    isSending: false,
    sendMessage: (...args: unknown[]) => mocks.sendMessage(...args),
  }),
}));

const store = createCanvasPageStore([], [], "pipe-1", "Pipeline 1");

const Wrapper = ({ children }: { children?: ReactNode }) => (
  <CanvasPageStoreContext.Provider value={store}>
    <AgentBarStoreProvider pipelineId="pipe-1">{children}</AgentBarStoreProvider>
  </CanvasPageStoreContext.Provider>
);

const Harness = () => {
  const { conversationState, streamingAssistantText, submitMessage } = useAgentConversation({
    pipelineId: "pipe-1",
  });

  return (
    <div>
      <button
        type="button"
        onClick={() => void submitMessage({ content: "Tighten graph", runtimeId: "runtime-1" })}
      >
        Send
      </button>
      <span data-testid="state">{conversationState}</span>
      <span data-testid="stream">{streamingAssistantText}</span>
    </div>
  );
};

const EnsureSessionHarness = () => {
  const { ensureSession } = useAgentConversation({ pipelineId: "pipe-1" });
  const [sessionA, setSessionA] = useState("");
  const [sessionB, setSessionB] = useState("");

  return (
    <div>
      <button type="button" onClick={() => void ensureSession().then(setSessionA)}>
        Ensure A
      </button>
      <button type="button" onClick={() => void ensureSession().then(setSessionB)}>
        Ensure B
      </button>
      <span data-testid="session-a">{sessionA}</span>
      <span data-testid="session-b">{sessionB}</span>
    </div>
  );
};

const ApplyGenerateProposalHarness = ({
  onGeneratedPipeline,
}: {
  onGeneratedPipeline: (pipelineId: string) => void;
}) => {
  const agentBarStore = useAgentBarStoreApi();
  const { applyProposal, conversationState, streamingProgress } = useAgentConversation({
    onGeneratedPipeline,
    pipelineId: "pipe-1",
  });

  useEffect(() => {
    const state = agentBarStore.getState();
    state.setSession("session-generate", "graph-generate");
    state.setProposalId("proposal-generate");
    state.setGenerateProposal({
      assumptions: [],
      executionFlow: ["input -> output"],
      inputs: ["input"],
      majorOperations: ["generate"],
      mode: "generate",
      openQuestions: [],
      outputs: ["output"],
      purpose: "Generate a pipeline",
      readiness: "ready_for_generation",
    });
  }, [agentBarStore]);

  return (
    <div>
      <button type="button" onClick={() => void applyProposal("runtime-1")}>
        Apply
      </button>
      <span data-testid="apply-state">{conversationState}</span>
      <span data-testid="apply-progress">{streamingProgress}</span>
    </div>
  );
};

describe("useAgentConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isHistoryLoading = false;
    mocks.createSession.mockResolvedValue({
      entrypoint: "canvas-agent-panel",
      id: "session-1",
      mode: "edit",
      status: "draft",
    });
    mocks.appendMessage.mockResolvedValue({ id: "message-1" });
    mocks.approveProposal.mockResolvedValue(undefined);
    mocks.generatePipelineFromApprovedProposal.mockResolvedValue({ pipelineId: "pipeline-new" });
    mocks.getLatestAssistantQuestion.mockResolvedValue(null);
    mocks.getLatestReadyProposal.mockResolvedValue(null);
    mocks.sendMessage.mockResolvedValue({ id: "persisted-message" });
  });

  it("transitions idle to thinking to streaming to done while processing SSE events", async () => {
    let emit: ((event: PipelineAgentPlanEvent) => void) | null = null;
    let finishStream: (() => void) | null = null;
    mocks.planSessionStream.mockImplementation(
      async (_sessionId: string, input: { onEvent: (event: PipelineAgentPlanEvent) => void }) => {
        emit = input.onEvent;
        input.onEvent({ phase: "planning", type: "phase" });
        await new Promise<void>((resolve) => {
          finishStream = resolve;
        });
      },
    );

    render(<Harness />, { wrapper: Wrapper });
    expect(screen.getByTestId("state")).toHaveTextContent("idle");

    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("thinking"));

    act(() => emit?.({ text: "Drafting", type: "assistant_chunk" }));
    expect(screen.getByTestId("state")).toHaveTextContent("streaming");
    expect(screen.getByTestId("stream")).toHaveTextContent("Drafting");

    act(() => emit?.({ question: "Which branch?", type: "question" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("done"));

    act(() => finishStream?.());
    await waitFor(() => {
      expect(mocks.sendMessage).toHaveBeenCalledWith({
        content: "Which branch?",
        phase: "done",
        role: "assistant",
      });
    });
  });

  it("sends the serialized current context before the user message", async () => {
    mocks.planSessionStream.mockImplementation(
      async (_sessionId: string, input: { onEvent: (event: PipelineAgentPlanEvent) => void }) => {
        input.onEvent({ question: "Done", type: "question" });
      },
    );

    render(<Harness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(mocks.appendMessage).toHaveBeenCalledTimes(2));
    expect(mocks.appendMessage.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        kind: "text",
        role: "system",
        content: expect.stringContaining('"pipelineId":"pipe-1"'),
      }),
    );
    expect(mocks.appendMessage.mock.calls[1]?.[1]).toEqual({
      content: "Tighten graph",
      kind: "text",
      role: "user",
    });
  });

  it("does not create a session while conversation history is loading", async () => {
    mocks.isHistoryLoading = true;

    render(<Harness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("shares one session creation across concurrent callers", async () => {
    let resolveSession: ((session: { id: string }) => void) | null = null;
    mocks.createSession.mockImplementation(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveSession = resolve;
        }),
    );

    render(<EnsureSessionHarness />, { wrapper: Wrapper });
    await userEvent.click(screen.getByRole("button", { name: "Ensure A" }));
    await userEvent.click(screen.getByRole("button", { name: "Ensure B" }));

    expect(mocks.createSession).toHaveBeenCalledTimes(1);
    act(() =>
      resolveSession?.({
        id: "session-1",
      }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("session-a")).toHaveTextContent("session-1");
      expect(screen.getByTestId("session-b")).toHaveTextContent("session-1");
    });
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });

  it("shows a specific generation status and clears it before opening the created pipeline", async () => {
    let resolveGeneration: ((value: { pipelineId: string }) => void) | null = null;
    mocks.generatePipelineFromApprovedProposal.mockImplementation(
      () =>
        new Promise<{ pipelineId: string }>((resolve) => {
          resolveGeneration = resolve;
        }),
    );
    const onGeneratedPipeline = vi.fn();

    render(<ApplyGenerateProposalHarness onGeneratedPipeline={onGeneratedPipeline} />, {
      wrapper: Wrapper,
    });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(screen.getByTestId("apply-state")).toHaveTextContent("thinking");
      expect(screen.getByTestId("apply-progress")).toHaveTextContent(
        "canvas.agentPanel.generatingPipeline",
      );
    });

    act(() => resolveGeneration?.({ pipelineId: "pipeline-new" }));
    await waitFor(() => {
      expect(screen.getByTestId("apply-state")).toHaveTextContent("done");
      expect(screen.getByTestId("apply-progress")).toBeEmptyDOMElement();
      expect(onGeneratedPipeline).toHaveBeenCalledWith("pipeline-new");
    });
  });
});
