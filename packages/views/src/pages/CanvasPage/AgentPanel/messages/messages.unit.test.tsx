import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Assistant,
  Bubble,
  ClarifyOptions,
  ErrorActions,
  CompletionCard,
  DistillCard,
  ErrorCard,
  MessageTurn,
  ProgressList,
  ProposalCard,
  RunStatusCard,
  SelfHealCard,
  SuggestionList,
} from ".";
import type { AgentBarMessage } from "../_store";

const proposalItems = [
  { title: "Source", detail: "Input - Folder" },
  { title: "Verify", detail: "Compound - Generator/Critic" },
];

describe("AgentBar message components", () => {
  it("copies, edits, and retries a user message through the current runtime", async () => {
    const user = userEvent.setup();
    const onEditDraft = vi.fn();
    const onSubmit = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const message: AgentBarMessage = {
      content: "Add a validation node.",
      id: "user-1",
      role: "user",
    };

    render(
      <MessageTurn
        isLast
        isSending={false}
        message={message}
        runtimeId="runtime-1"
        visibleMessages={[message]}
        onEditDraft={onEditDraft}
        onOpenSettings={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByTestId("agent-message-action-copy"));
    await user.click(screen.getByTestId("agent-message-action-edit"));
    await user.click(screen.getByTestId("agent-message-action-retry"));

    expect(writeText).toHaveBeenCalledWith(message.content);
    expect(onEditDraft).toHaveBeenCalledWith(message.content);
    expect(onSubmit).toHaveBeenCalledWith({ content: message.content, runtimeId: "runtime-1" });
  });

  it("shows clarify choices and only retries the latest user message from error metadata", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const firstMessage: AgentBarMessage = { content: "Build it", id: "user-1", role: "user" };
    const assistantMessage: AgentBarMessage = {
      content: "Which source should I use?",
      id: "assistant-1",
      metadata: { clarifyOptions: ["Use the existing source"] },
      role: "assistant",
    };

    const { rerender } = render(
      <MessageTurn
        isLast
        isSending={false}
        message={assistantMessage}
        runtimeId="runtime-1"
        visibleMessages={[firstMessage, assistantMessage]}
        onEditDraft={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Use the existing source" }));
    expect(onSubmit).toHaveBeenCalledWith({
      content: "Use the existing source",
      runtimeId: "runtime-1",
    });

    const errorMessage: AgentBarMessage = {
      content: "The request failed.",
      id: "assistant-error",
      metadata: { proposeErrorCode: "AGENT_FAILED" },
      role: "assistant",
    };
    rerender(
      <MessageTurn
        isLast
        isSending={false}
        message={errorMessage}
        runtimeId="runtime-1"
        visibleMessages={[firstMessage, errorMessage]}
        onEditDraft={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByTestId("agent-error-retry"));
    expect(onSubmit).toHaveBeenLastCalledWith({
      content: firstMessage.content,
      runtimeId: "runtime-1",
    });
  });

  it("keeps runtime-dependent actions inactive until a runtime is selected", () => {
    const userMessage: AgentBarMessage = {
      content: "Add a validation node.",
      id: "user-without-runtime",
      role: "user",
    };
    const { rerender } = render(
      <MessageTurn
        isLast
        isSending={false}
        message={userMessage}
        runtimeId={null}
        visibleMessages={[userMessage]}
        onEditDraft={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("agent-message-action-retry")).not.toBeInTheDocument();
    expect(screen.getByTestId("agent-message-action-edit")).toBeEnabled();

    const clarifyMessage: AgentBarMessage = {
      content: "Choose a source.",
      id: "clarify-without-runtime",
      metadata: { clarifyOptions: ["Use the current source"] },
      role: "assistant",
    };
    rerender(
      <MessageTurn
        isLast
        isSending={false}
        message={clarifyMessage}
        runtimeId={null}
        visibleMessages={[clarifyMessage]}
        onEditDraft={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Use the current source" })).toBeDisabled();

    const errorMessage: AgentBarMessage = {
      content: "The request failed.",
      id: "error-without-runtime",
      metadata: { proposeErrorCode: "AGENT_FAILED" },
      role: "assistant",
    };
    rerender(
      <MessageTurn
        isLast
        isSending={false}
        message={errorMessage}
        runtimeId={null}
        visibleMessages={[errorMessage]}
        onEditDraft={vi.fn()}
        onOpenSettings={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByTestId("agent-error-retry")).toBeDisabled();
  });

  it("renders conversation primitives without card chrome", () => {
    render(
      <div>
        <Bubble>Build a quiz pipeline.</Bubble>
        <Assistant>Reading the canvas context.</Assistant>
        <Assistant isThinking>Thinking…</Assistant>
      </div>,
    );

    expect(screen.getByText("Build a quiz pipeline.")).toBeInTheDocument();
    expect(screen.getByText("Reading the canvas context.")).toBeInTheDocument();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("renders the minimal proposal block with inline actions", async () => {
    const user = userEvent.setup();
    const handleApply = vi.fn();
    render(
      <ProposalCard
        items={proposalItems}
        subtitle="Reuses 2 components"
        title="Proposal - 5 nodes"
        onApply={handleApply}
      />,
    );

    expect(screen.getByText(/Proposal - 5 nodes/)).toBeInTheDocument();
    expect(screen.getByTestId("agent-progress-list")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    await user.click(screen.getByTestId("agent-proposal-apply"));
    expect(handleApply).toHaveBeenCalledTimes(1);
  });

  it("renders run, self-heal, error, completion, and distill lines", async () => {
    const user = userEvent.setup();
    const handleAction = vi.fn();
    render(
      <div>
        <RunStatusCard costLabel="14.6s - $0.14" subtitle="Step 3 of 5" title="job_8f2a" />
        <SelfHealCard
          steps={[{ label: "Retried with smaller chunks", tone: "success" }]}
          subtitle="round 2"
          title="Self-healed the Parse step"
        />
        <ErrorCard
          title="Connector needs a token"
          tryLabel="Connect Notion"
          what="Export cannot reach Notion."
          why="Connector is not authorized."
          onAction={handleAction}
        />
        <CompletionCard subtitle="$0.31" title="Done in 41.3s">
          Exported quiz questions.
        </CompletionCard>
        <DistillCard subtitle="open in Components" title="Saved as a Pipeline Skill" />
      </div>,
    );

    expect(screen.getByText("job_8f2a")).toBeInTheDocument();
    expect(screen.queryByText(/Retried with smaller chunks/)).not.toBeInTheDocument();
    expect(screen.getByTestId("agent-self-heal-toggle")).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByTestId("agent-self-heal-toggle"));
    expect(screen.getByTestId("agent-self-heal-toggle")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Retried with smaller chunks/)).toBeInTheDocument();
    await user.click(screen.getByTestId("agent-error-action"));
    expect(handleAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Done in 41.3s/)).toBeInTheDocument();
    expect(screen.getByText(/Saved as a Pipeline Skill/)).toBeInTheDocument();
  });

  it("renders progress lists and suggestion rows", () => {
    render(
      <div>
        <ProgressList
          showStatus
          items={[
            { detail: "20 MCQs", done: true, id: "structure", title: "Read structure" },
            { detail: "5 nodes", done: false, id: "draft", title: "Drafting pipeline" },
          ]}
        />
        <SuggestionList
          items={[
            { id: "quiz", label: "Turn PDFs into a quiz" },
            { id: "reverse", label: "Upload a finished sample", reverse: true },
          ]}
        />
      </div>,
    );

    expect(screen.getByText("Read structure")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn PDFs into a quiz" })).toBeInTheDocument();
  });

  it("sends the clicked clarify option verbatim", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    render(<ClarifyOptions options={["本地文件夹", "GitHub 仓库"]} onSelect={handleSelect} />);

    expect(screen.getByTestId("agent-clarify-options")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "GitHub 仓库" }));

    expect(handleSelect).toHaveBeenCalledWith("GitHub 仓库");
  });

  it("disables clarify options while a message is sending", () => {
    render(<ClarifyOptions disabled options={["本地文件夹"]} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "本地文件夹" })).toBeDisabled();
  });

  it("shows Ask-agent-to-fix and disables Apply when diagnostics block the proposal", async () => {
    const user = userEvent.setup();
    const handleAskFix = vi.fn();
    render(
      <ProposalCard
        items={proposalItems}
        subtitle="Resolve diagnostics before applying"
        title="Proposal - 2 nodes"
        onApply={vi.fn()}
        onAskFix={handleAskFix}
      />,
    );

    expect(screen.getByTestId("agent-proposal-apply")).toBeDisabled();
    await user.click(screen.getByTestId("agent-proposal-ask-fix"));

    expect(handleAskFix).toHaveBeenCalled();
  });

  it("routes runtime errors to settings and transient errors to retry", async () => {
    const user = userEvent.setup();
    const handleOpenSettings = vi.fn();
    const handleRetry = vi.fn();
    const { rerender } = render(
      <ErrorActions
        code="RUNTIME_NOT_FOUND"
        onOpenSettings={handleOpenSettings}
        onRetry={handleRetry}
      />,
    );

    await user.click(screen.getByTestId("agent-error-open-settings"));
    expect(handleOpenSettings).toHaveBeenCalled();

    rerender(
      <ErrorActions
        code="AGENT_FAILED"
        onOpenSettings={handleOpenSettings}
        onRetry={handleRetry}
      />,
    );
    await user.click(screen.getByTestId("agent-error-retry"));
    expect(handleRetry).toHaveBeenCalled();
  });
});
