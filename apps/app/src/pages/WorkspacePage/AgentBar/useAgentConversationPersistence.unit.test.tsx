import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationMessage } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useAgentBarStore } from "./_store";
import { useAgentConversationPersistence } from "./useAgentConversationPersistence";

const refineMocks = vi.hoisted(() => ({
  createConversationMessage: vi.fn(),
  conversationMessages: [] as ConversationMessage[],
  refetch: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({
    mutateAsync: refineMocks.createConversationMessage,
    mutation: { isPending: false },
  }),
  useList: () => ({
    query: { isLoading: false, refetch: refineMocks.refetch },
    result: {
      data: refineMocks.conversationMessages,
      total: refineMocks.conversationMessages.length,
    },
  }),
}));

const ConversationHarness = () => {
  const { sendMessage } = useAgentConversationPersistence({
    phase: "clarify",
    pipelineId: "pipe-1",
  });
  const handleSendClick = () => {
    void sendMessage({
      content: " Persist this ",
      metadata: {
        attachments: [{ name: "sample.pdf" }],
        referencedNodeIds: ["node-1"],
      },
    });
  };

  return (
    <button type="button" onClick={handleSendClick}>
      Send persisted message
    </button>
  );
};

describe("useAgentConversationPersistence", () => {
  beforeEach(() => {
    refineMocks.createConversationMessage.mockReset();
    refineMocks.refetch.mockReset();
    refineMocks.refetch.mockResolvedValue({});
    refineMocks.conversationMessages = [];
    useAgentBarStore.getState().resetAgentBar();
  });

  it("hydrates agent bar messages from conversation history", async () => {
    refineMocks.conversationMessages = [
      {
        content: "Previously persisted",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "msg-1",
        metadata: { referencedNodeIds: ["node-1"] },
        phase: "proposal",
        pipelineId: "pipe-1",
        role: "agent",
      },
    ];

    render(<ConversationHarness />);

    await waitFor(() => {
      expect(useAgentBarStore.getState().messages).toEqual([
        expect.objectContaining({
          content: "Previously persisted",
          id: "msg-1",
          metadata: { referencedNodeIds: ["node-1"] },
          phase: "proposal",
          role: "assistant",
        }),
      ]);
    });
  });

  it("persists sent messages with phase and metadata", async () => {
    const user = userEvent.setup();
    refineMocks.createConversationMessage.mockResolvedValue({
      data: {
        content: "Persist this",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "msg-created",
        metadata: {
          attachments: [{ name: "sample.pdf" }],
          referencedNodeIds: ["node-1"],
        },
        phase: "clarify",
        pipelineId: "pipe-1",
        role: "user",
      },
    });

    render(<ConversationHarness />);
    await user.click(screen.getByRole("button", { name: "Send persisted message" }));

    await waitFor(() => {
      expect(refineMocks.createConversationMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: ResourceName.conversationMessages,
          values: expect.objectContaining({
            content: "Persist this",
            metadata: {
              attachments: [{ name: "sample.pdf" }],
              referencedNodeIds: ["node-1"],
            },
            phase: "clarify",
            pipelineId: "pipe-1",
            role: "user",
          }),
        }),
      );
    });
    expect(refineMocks.refetch).toHaveBeenCalled();
    expect(useAgentBarStore.getState().messages).toEqual([
      expect.objectContaining({
        content: "Persist this",
        metadata: {
          attachments: [{ name: "sample.pdf" }],
          referencedNodeIds: ["node-1"],
        },
        phase: "clarify",
        role: "user",
      }),
    ]);
  });
});
