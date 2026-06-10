import type { Meta, StoryObj } from "@storybook/react";
import {
  AppliedCard,
  Assistant,
  Bubble,
  Card,
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
  { title: "Source - Textbook PDFs", detail: "Input - Folder" },
  { title: "Parse & Extract", detail: "Op - parser.skill on Claude Code" },
  { title: "Generate Vocab Quiz", detail: "Op - Codex" },
  { title: "Adversarial Verify", detail: "Compound - Generator <-> Critic" },
  { title: "Export to Notion", detail: "Connector - notion-mcp" },
];

const meta: Meta = {
  title: "WorkspacePage/AgentBar/messages",
  decorators: [
    (Story) => (
      <div className="w-[360px] bg-surface p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: "Pure Agent Bar message and card components used by the six workspace phases.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const UserBubble: Story = {
  render: () => (
    <Bubble>
      I want to turn the textbook PDFs in this folder into a vocabulary quiz that lives in Notion.
    </Bubble>
  ),
};

export const AssistantMessage: Story = {
  render: () => (
    <Assistant>
      Got it. Before I draft the pipeline, should the quiz mix vocabulary and grammar or stay
      vocab-only?
    </Assistant>
  ),
};

export const GenericCard: Story = {
  render: () => (
    <Card>
      <div className="px-3 py-2.5 text-[12px]">Neutral surface for custom Agent Bar content.</div>
    </Card>
  ),
};

export const Proposal: Story = {
  render: () => (
    <ProposalCard
      items={proposalItems}
      subtitle="Reuses 2 components from your library"
      title="Proposal - 5 nodes, 4 edges"
    />
  ),
};

export const Applied: Story = {
  render: () => <AppliedCard detail="Pipeline is on the canvas" title="Applied - 5 nodes" />,
};

export const RunStatus: Story = {
  render: () => (
    <RunStatusCard
      costLabel="14.6s - $0.14"
      subtitle="Step 3 of 5 - Generate Vocab Quiz"
      title="Running - job_8f2a"
    />
  ),
};

export const SelfHeal: Story = {
  render: () => (
    <SelfHealCard
      open
      steps={[
        { label: "8k chunk caused context overflow on file 3." },
        { label: "Switched to 4k chunk and retried the parser." },
        { label: "Continuing with the working configuration.", tone: "success" },
      ]}
      subtitle="Parse step retried with a smaller chunk size"
      title="Self-heal - round 2 - resolved"
    />
  ),
};

export const Error: Story = {
  render: () => (
    <ErrorCard
      title="Heads up - Notion connector needs a token"
      tryLabel="Connectors -> Notion -> Connect"
      what="The Export step cannot reach your Notion database yet."
      why="The connector has not been authorized."
    />
  ),
};

export const Completion: Story = {
  render: () => (
    <CompletionCard
      subtitle="20 questions - verified in 2 rounds"
      title="Completed - 41.3s - $0.31"
    >
      Exported <strong>20 vocabulary + grammar questions</strong> to Notion. Verify caught 3
      ambiguous distractors and rewrote them.
    </CompletionCard>
  ),
};

export const Distill: Story = {
  render: () => (
    <DistillCard
      subtitle="Textbook -> Notion Quiz - saved to Components"
      title="Distilled to a Pipeline Skill"
    />
  ),
};

export const ClarifyOptions: Story = {
  render: () => (
    <OptionGrid
      items={[
        { id: "vocab", label: "Vocab only" },
        { active: true, id: "grammar", label: "Vocab + grammar" },
        { active: true, id: "verify", label: "+ Verify step" },
        { id: "skip", label: "Skip verify" },
      ]}
    />
  ),
};

export const Suggestions: Story = {
  render: () => (
    <SuggestionList
      items={[
        { id: "quiz", label: "Turn my textbook PDFs into a Notion quiz" },
        { id: "repo", label: "Summarize a GitHub repo into a changelog" },
        {
          id: "reverse",
          label: "Upload a finished sample -> reverse-engineer it",
          priorityLabel: "P1",
          reverse: true,
        },
      ]}
    />
  ),
};
