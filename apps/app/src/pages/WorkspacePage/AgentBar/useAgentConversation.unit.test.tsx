import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationMessage, PipelineActionProposal } from "@repo/schemas";
import { ResourceName, dataProvider } from "@/integrations/refine/dataProvider";
import { CanvasStoreContext, createCanvasStore } from "../canvas/_store/canvasStore";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentBarStore } from "./_store";
import { useAgentConversation } from "./useAgentConversation";

const refineMocks = vi.hoisted(() => ({
  conversationMessages: [] as ConversationMessage[],
  createConversationMessage: vi.fn(async ({ values }) => ({ data: values })),
  refetchConversationMessages: vi.fn(async () => ({})),
  updatePipeline: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({
    mutateAsync: refineMocks.createConversationMessage,
    mutation: { isPending: false },
  }),
  useList: () => ({
    query: { isLoading: false, refetch: refineMocks.refetchConversationMessages },
    result: {
      data: refineMocks.conversationMessages,
      total: refineMocks.conversationMessages.length,
    },
  }),
  useUpdate: () => ({
    mutateAsync: refineMocks.updatePipeline,
    mutation: { isPending: false },
  }),
}));

const makeProposal = (): PipelineActionProposal =>
  ({
    actions: [
      {
        node: {
          data: { label: "Prompt", nodeType: "prompt", prompt: "hello" },
          id: "node-new",
          position: { x: 100, y: 100 },
          type: "prompt",
        },
        type: "addNode",
      },
    ],
    summary: "Add a prompt node",
  }) as PipelineActionProposal;

const Harness = () => {
  const {
    applyProposal,
    isSending,
    pendingProposal,
    proposalItems,
    requestProposalFix,
    submitMessage,
  } = useAgentConversation({
      phase: "empty",
      pipelineId: "pipe-1",
      pipelineName: "Pipeline 1",
    });
  const handleSendClick = () => {
    void submitMessage({
      content: "Add prompt",
      metadata: { referencedNodeIds: ["node-1"] },
    });
  };
  const handleReverseClick = () => {
    void submitMessage({
      content: "Reverse-engineer this sample",
      metadata: { attachments: [{ name: "finished.csv" }] },
    });
  };
  const handleApplyClick = () => {
    void applyProposal();
  };

  return (
    <div>
      <button type="button" onClick={handleSendClick}>
        Send
      </button>
      <button type="button" onClick={handleReverseClick}>
        Reverse
      </button>
      <button type="button" onClick={handleApplyClick}>
        Apply
      </button>
      <button type="button" onClick={() => void requestProposalFix()}>
        Fix
      </button>
      <span data-testid="sending">{String(isSending)}</span>
      <span data-testid="proposal">{pendingProposal?.summary ?? ""}</span>
      <span data-testid="items">{proposalItems.map((item) => item.title).join(",")}</span>
    </div>
  );
};

describe("useAgentConversation", () => {
  beforeEach(() => {
    refineMocks.conversationMessages = [];
    refineMocks.createConversationMessage.mockClear();
    refineMocks.refetchConversationMessages.mockClear();
    refineMocks.updatePipeline.mockReset();
    refineMocks.updatePipeline.mockResolvedValue({ data: {} });
    vi.spyOn(dataProvider, "custom").mockResolvedValue({
      data: { diagnostics: [], proposal: makeProposal(), reply: "Drafted" },
    });
    useAgentBarStore.getState().resetAgentBar();
    useWorkspaceStore.getState().resetWorkspace();
  });

  it("proposes actions, stores proposal metadata, and switches to proposal phase", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();

    render(
      <CanvasStoreContext.Provider value={store}>
        <Harness />
      </CanvasStoreContext.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByTestId("proposal")).toHaveTextContent("Add a prompt node");
    });
    expect(dataProvider.custom).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: "pipe-1",
          message: "Add prompt",
          snapshot: { edges: [], nodes: [] },
        }),
        url: "pipelines/proposeActions",
      }),
    );
    expect(useWorkspaceStore.getState().phase).toBe("proposal");
    expect(useAgentBarStore.getState().messages.at(-1)).toEqual(
      expect.objectContaining({
        content: "Drafted",
        metadata: { proposalSnapshot: { addedEdges: [], addedNodes: ["node-new"] } },
        role: "assistant",
      }),
    );
  });

  it("applies the pending proposal and persists the pipeline graph", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.setState({ applyProposal: vi.fn(() => true) });

    render(
      <CanvasStoreContext.Provider value={store}>
        <Harness />
      </CanvasStoreContext.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getByTestId("proposal")).toHaveTextContent("Add a prompt node");
    });
    store.setState({
      edges: [],
      nodes: [
        {
          data: { label: "Prompt", nodeType: "prompt", prompt: "hello" },
          id: "node-new",
          position: { x: 100, y: 100 },
          type: "prompt",
        } as never,
      ],
    });

    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(refineMocks.updatePipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pipe-1",
          resource: ResourceName.pipelines,
          values: expect.objectContaining({
            nodes: expect.arrayContaining([expect.objectContaining({ id: "node-new" })]),
          }),
        }),
      );
    });
    expect(useWorkspaceStore.getState().phase).toBe("applied");
  });

  it("passes uploaded sample metadata to proposal generation", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();

    render(
      <CanvasStoreContext.Provider value={store}>
        <Harness />
      </CanvasStoreContext.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Reverse" }));

    await waitFor(() => {
      expect(dataProvider.custom).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            attachments: [{ name: "finished.csv" }],
            message: "Reverse-engineer this sample",
          }),
          url: "pipelines/proposeActions",
        }),
      );
    });
  });

  it("sends diagnostics and the failed proposal when asking the agent to fix", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    vi.spyOn(dataProvider, "custom").mockResolvedValue({
      data: {
        diagnostics: [
          { actionIndex: 0, code: "INVALID_NODE_DATA", message: "unknown op", severity: "error" },
        ],
        proposal: makeProposal(),
        reply: "Drafted",
      },
    });

    render(
      <CanvasStoreContext.Provider value={store}>
        <Harness />
      </CanvasStoreContext.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => {
      expect(screen.getByTestId("proposal")).toHaveTextContent("Add a prompt node");
    });

    await user.click(screen.getByRole("button", { name: "Fix" }));

    await waitFor(() => {
      expect(dataProvider.custom).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            diagnostics: ["unknown op"],
            failedProposal: expect.objectContaining({ summary: "Add a prompt node" }),
          }),
          url: "pipelines/proposeActions",
        }),
      );
    });
  });
});
