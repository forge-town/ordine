import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentBarStore } from "./_store";
import { AgentBar, WORKSPACE_PHASES } from "./AgentBar";

vi.mock("./useAgentConversationPersistence", () => ({
  useAgentConversationPersistence: () => ({
    isSending: false,
    sendMessage: vi.fn(),
  }),
}));

const renderAgentBar = (handleCollapse = vi.fn()) => {
  render(<AgentBar pipelineId="pipe-test" onCollapse={handleCollapse} />);

  return { handleCollapse };
};

describe("AgentBar", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
    useAgentBarStore.getState().resetAgentBar();
  });

  it("renders the header, context tags, and empty phase body", () => {
    renderAgentBar();

    expect(screen.getByTestId("workspace-agent-bar")).toBeInTheDocument();
    expect(screen.getByText("Agent Bar")).toBeInTheDocument();
    expect(screen.getByText("New canvas - no pipeline yet")).toBeInTheDocument();
    expect(screen.getByText("pipe-test")).toBeInTheDocument();
    expect(screen.getAllByText("empty")).toHaveLength(2);
    expect(screen.getByText("Turn my textbook PDFs into a Notion quiz")).toBeInTheDocument();
  });

  it("switches all six phases from the dev phase controls", async () => {
    const user = userEvent.setup();
    renderAgentBar();

    for (const phase of WORKSPACE_PHASES) {
      await user.click(screen.getByRole("button", { name: phase }));
      expect(useWorkspaceStore.getState().phase).toBe(phase);
    }

    expect(screen.getByText("Run complete - asset saved")).toBeInTheDocument();
    expect(screen.getByText("Distilled to a Pipeline Skill")).toBeInTheDocument();
  });

  it("renders conversation messages after the scripted phase body", () => {
    useAgentBarStore.getState().addMessage({
      content: "Please make the quiz harder.",
      id: "m1",
      role: "user",
    });
    useAgentBarStore.getState().addMessage({
      content: "I will tighten the distractors.",
      id: "m2",
      role: "assistant",
    });

    renderAgentBar();

    expect(screen.getByText("Please make the quiz harder.")).toBeInTheDocument();
    expect(screen.getByText("I will tighten the distractors.")).toBeInTheDocument();
  });

  it("calls collapse handler from the header button", async () => {
    const user = userEvent.setup();
    const handleCollapse = vi.fn();
    renderAgentBar(handleCollapse);

    await user.click(screen.getByRole("button", { name: "Collapse Agent Bar" }));

    expect(handleCollapse).toHaveBeenCalledTimes(1);
  });
});
