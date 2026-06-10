import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  AppliedCard,
  Assistant,
  Bubble,
  CompletionCard,
  DistillCard,
  ErrorCard,
  OptionGrid,
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
  it("renders conversation primitives", () => {
    render(
      <div>
        <Bubble>Build a quiz pipeline.</Bubble>
        <Assistant>Reading the canvas context.</Assistant>
      </div>,
    );

    expect(screen.getByText("Build a quiz pipeline.")).toBeInTheDocument();
    expect(screen.getByText("Reading the canvas context.")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("renders proposal cards with action buttons", () => {
    const handleApply = vi.fn();
    render(
      <ProposalCard
        items={proposalItems}
        subtitle="Reuses 2 components"
        title="Proposal - 5 nodes"
        onApply={handleApply}
      />,
    );

    expect(screen.getByText("Proposal - 5 nodes")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
  });

  it("renders status and result cards", () => {
    render(
      <div>
        <AppliedCard detail="Pipeline is on canvas" title="Applied - 5 nodes" />
        <RunStatusCard costLabel="14.6s - $0.14" subtitle="Step 3 of 5" title="Running - job" />
        <SelfHealCard
          open
          steps={[{ label: "Retried with smaller chunks", tone: "success" }]}
          subtitle="Parser recovered"
          title="Self-heal - resolved"
        />
        <ErrorCard
          title="Connector needs a token"
          tryLabel="Connectors -> Notion"
          what="Export cannot reach Notion."
          why="Connector is not authorized."
        />
        <CompletionCard subtitle="Verified in 2 rounds" title="Completed - $0.31">
          Exported quiz questions.
        </CompletionCard>
        <DistillCard subtitle="Saved to Components" title="Distilled to a Pipeline Skill" />
      </div>,
    );

    expect(screen.getByText("Applied - 5 nodes")).toBeInTheDocument();
    expect(screen.getByText("Running - job")).toBeInTheDocument();
    expect(screen.getByText(/Retried with smaller chunks/)).toBeInTheDocument();
    expect(screen.getByText("Connector needs a token")).toBeInTheDocument();
    expect(screen.getByText("Completed - $0.31")).toBeInTheDocument();
    expect(screen.getByText("Distilled to a Pipeline Skill")).toBeInTheDocument();
  });

  it("renders option and suggestion controls", () => {
    render(
      <div>
        <OptionGrid
          items={[
            { active: true, id: "grammar", label: "Vocab + grammar" },
            { id: "verify", label: "Skip verify" },
          ]}
        />
        <SuggestionList
          items={[
            { id: "quiz", label: "Turn PDFs into a quiz" },
            {
              id: "reverse",
              label: "Upload a finished sample",
              priorityLabel: "P1",
              reverse: true,
            },
          ]}
        />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Vocab + grammar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn PDFs into a quiz" })).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
  });
});
