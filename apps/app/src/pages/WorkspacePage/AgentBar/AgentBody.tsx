import type { WorkspacePhase } from "@repo/schemas";
import {
  AppliedCard,
  Assistant,
  Bubble,
  CompletionCard,
  OptionGrid,
  ProposalCard,
  SuggestionList,
} from "./messages";

const proposalItems = [
  { title: "Source - Textbook PDFs", detail: "Input - Folder" },
  { title: "Parse & Extract", detail: "Op - parser.skill on Claude Code" },
  { title: "Generate Vocab Quiz", detail: "Op - Codex" },
  { title: "Adversarial Verify", detail: "Compound - Generator/Critic" },
  { title: "Export to Notion", detail: "Connector - notion-mcp" },
];

const userGoal = (
  <Bubble>
    I want to turn the textbook PDFs in this folder into a vocabulary quiz that lives in my Notion
    study DB.
  </Bubble>
);

export type AgentBodyProps = {
  distillContent?: React.ReactNode;
  runContent?: React.ReactNode;
  phase: WorkspacePhase;
  onPhaseChange?: (phase: WorkspacePhase) => void;
};

export const AgentBody = ({ distillContent, onPhaseChange, phase, runContent }: AgentBodyProps) => {
  const handleClarifyClick = () => onPhaseChange?.("clarify");
  const handleProposalClick = () => onPhaseChange?.("proposal");
  const handleAppliedClick = () => onPhaseChange?.("applied");

  if (phase === "empty") {
    return (
      <>
        <Assistant>
          New canvas. Tell me what you want to make, or drop a finished sample and I will infer the
          pipeline that produces it.
        </Assistant>
        <SuggestionList
          items={[
            {
              id: "textbook-quiz",
              label: "Turn my textbook PDFs into a Notion quiz",
              onSelect: handleClarifyClick,
            },
            {
              id: "repo-changelog",
              label: "Summarize a GitHub repo into a changelog",
              onSelect: handleClarifyClick,
            },
            {
              id: "reverse-sample",
              label: "Upload a finished sample and infer the pipeline",
              onSelect: handleProposalClick,
              priorityLabel: "P1",
              reverse: true,
            },
          ]}
        />
      </>
    );
  }

  if (phase === "clarify") {
    return (
      <>
        {userGoal}
        <Assistant>
          Got it. Before I draft the pipeline, should the quiz mix vocabulary and grammar or stay
          vocab-only? Should I add a verify step before the Notion export?
        </Assistant>
        <OptionGrid
          items={[
            { id: "vocab", label: "Vocab only", onSelect: handleProposalClick },
            {
              active: true,
              id: "grammar",
              label: "Vocab + grammar",
              onSelect: handleProposalClick,
            },
            { active: true, id: "verify", label: "+ Verify step", onSelect: handleProposalClick },
            { id: "skip", label: "Skip verify", onSelect: handleProposalClick },
          ]}
        />
      </>
    );
  }

  if (phase === "proposal") {
    return (
      <>
        {userGoal}
        <Assistant>
          Here is a pipeline that does it end to end. I reused your Parse PDF and Notion DB
          components. Preview is on the canvas.
        </Assistant>
        <ProposalCard
          items={proposalItems}
          subtitle="Reuses 2 components from your library"
          title="Proposal - 5 nodes, 4 edges"
          onApply={handleAppliedClick}
          onRevise={handleClarifyClick}
        />
      </>
    );
  }

  if (phase === "applied") {
    return (
      <>
        {userGoal}
        <AppliedCard detail="Pipeline is on the canvas" title="Applied - 5 nodes" />
        <Assistant>
          Pipeline is ready to edit. Tune any node, inspect data contracts on edges, or run it when
          you are set.
        </Assistant>
      </>
    );
  }

  if (phase === "running") {
    return (
      <>
        {userGoal}
        {runContent}
      </>
    );
  }

  return (
    <>
      {userGoal}
      <CompletionCard
        subtitle="20 questions - verified in 2 rounds"
        title="Completed - 41.3s - $0.31"
      >
        Exported 20 vocabulary and grammar questions to Notion. Verify caught 3 ambiguous
        distractors and rewrote them.
      </CompletionCard>
      {distillContent}
      <Assistant>
        Saved this as a reusable Pipeline Skill. Next time, drop a new folder of PDFs and I will run
        the whole thing.
      </Assistant>
    </>
  );
};
