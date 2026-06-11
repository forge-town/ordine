import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Assistant,
  Bubble,
  ClarifyOptions,
  CompletionCard,
  DistillCard,
  ErrorCard,
  ProgressList,
  ProposalCard,
  RunStatusCard,
  SelfHealCard,
  SuggestionList,
} from ".";

const proposalItems = [
  { title: "Source", detail: "Input - Folder" },
  { title: "Verify", detail: "Compound - Generator/Critic" },
];

describe("AgentBar message components", () => {
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
    await user.click(screen.getByTestId("agent-self-heal-toggle"));
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
});
