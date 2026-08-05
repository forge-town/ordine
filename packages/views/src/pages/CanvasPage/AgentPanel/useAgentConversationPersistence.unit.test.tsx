import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationMessage } from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { AgentBarStoreProvider, useAgentBarStore } from "./_store";
import { HISTORY_WINDOW_LIMIT } from "./context";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

const refineMocks = vi.hoisted(() => ({
  createConversationMessage: vi.fn(),
  conversationMessages: [] as ConversationMessage[],
  refetch: vi.fn(),
  useList: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({
    mutateAsync: refineMocks.createConversationMessage,
    mutation: { isPending: false },
  }),
  useList: (input: unknown) => {
    refineMocks.useList(input);

    return {
      query: { isLoading: false, refetch: refineMocks.refetch },
      result: {
        data: refineMocks.conversationMessages,
        total: refineMocks.conversationMessages.length,
      },
    };
  },
}));

const ConversationHarness = () => {
  const messages = useAgentBarStore((state) => state.messages);
  const { sendMessage } = useAgentConversationPersistence({
    phase: "thinking",
    pipelineId: "pipe-1",
  });

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void sendMessage({
            content: " Persist this ",
            metadata: { referencedNodeIds: ["node-1"] },
          })
        }
      >
        Send persisted message
      </button>
      {messages.map((message) => (
        <span key={message.id}>{message.content}</span>
      ))}
    </div>
  );
};

const renderHarness = () =>
  render(
    <AgentBarStoreProvider pipelineId="pipe-1">
      <ConversationHarness />
    </AgentBarStoreProvider>,
  );

describe("useAgentConversationPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refineMocks.refetch.mockResolvedValue({});
    refineMocks.conversationMessages = [];
  });

  it("hydrates the latest persisted pipeline conversation window", async () => {
    refineMocks.conversationMessages = [
      {
        content: "Previously persisted",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "msg-1",
        metadata: { referencedNodeIds: ["node-1"] },
        phase: "done",
        pipelineId: "pipe-1",
        role: "agent",
      },
    ];

    renderHarness();

    expect(await screen.findByText("Previously persisted")).toBeInTheDocument();
    expect(refineMocks.useList).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          { field: "pipelineId", operator: "eq", value: "pipe-1" },
          { field: "limit", operator: "eq", value: HISTORY_WINDOW_LIMIT },
        ],
        resource: ResourceName.conversationMessages,
      }),
    );
  });

  it("persists trimmed messages with phase and metadata", async () => {
    refineMocks.createConversationMessage.mockResolvedValue({
      data: {
        content: "Persist this",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "msg-created",
        metadata: { referencedNodeIds: ["node-1"] },
        phase: "thinking",
        pipelineId: "pipe-1",
        role: "user",
      },
    });

    renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "Send persisted message" }));

    await waitFor(() => {
      expect(refineMocks.createConversationMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: ResourceName.conversationMessages,
          values: expect.objectContaining({
            content: "Persist this",
            metadata: { referencedNodeIds: ["node-1"] },
            phase: "thinking",
            pipelineId: "pipe-1",
            role: "user",
          }),
        }),
      );
    });
    expect(refineMocks.refetch).toHaveBeenCalled();
    expect(screen.getByText("Persist this")).toBeInTheDocument();
  });

  it("removes an optimistic message when persistence fails", async () => {
    refineMocks.createConversationMessage.mockRejectedValue(new Error("offline"));

    renderHarness();
    await userEvent.click(screen.getByRole("button", { name: "Send persisted message" }));

    await waitFor(() => {
      expect(screen.queryByText("Persist this")).not.toBeInTheDocument();
    });
  });
});
