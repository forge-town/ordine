import type { Meta, StoryObj } from "@storybook/react";
import {
  Assistant,
  Bubble,
  ClarifyOptions,
  CompletionCard,
  ErrorActions,
  DistillCard,
  ErrorCard,
  MessageActions,
  ProgressList,
  ProposalCard,
  RunStatusCard,
  SelfHealCard,
  SuggestionList,
} from ".";

const proposalItems = [
  { title: "Source · Textbook PDFs", detail: "Input · Folder" },
  { title: "Parse & Extract", detail: "Op · parser.skill on Claude Code" },
  { title: "Generate Vocab Quiz", detail: "Op · Codex" },
  { title: "Adversarial Verify", detail: "Compound · Generator ↔ Critic" },
  { title: "Export to Notion", detail: "Connector · notion-mcp" },
];

const meta: Meta = {
  title: "WorkspacePage/AgentBar/messages",
  decorators: [
    (Story) => (
      <div className="w-[360px] space-y-3 bg-surface p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Minimal (Codex-style) Agent Bar message primitives — plain text, left-border lists, inline actions, zero card chrome.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Conversation: Story = {
  render: () => (
    <>
      <Bubble>
        I want to turn the textbook PDFs in this folder into a vocabulary quiz that lives in Notion.
      </Bubble>
      <Assistant>
        Here’s a 5-node pipeline that does it end-to-end — it reuses your Parse PDF and Notion DB
        components.
      </Assistant>
      <Assistant isThinking>Thinking…</Assistant>
    </>
  ),
};

export const Proposal: Story = {
  render: () => (
    <ProposalCard
      items={proposalItems}
      subtitle="reuses 2 components"
      title="5-node pipeline"
      onApply={() => {}}
      onReject={() => {}}
      onRevise={() => {}}
    />
  ),
};

export const ReversingProgress: Story = {
  render: () => (
    <ProgressList
      items={[
        { detail: "20 MCQs · 4 options", done: true, id: "structure", title: "Read structure" },
        { detail: "parse → generate → verify", done: true, id: "steps", title: "Inferred steps" },
        { detail: "2 reusable", done: true, id: "matched", title: "Matched components" },
        { detail: "5 nodes · 4 edges", done: false, id: "draft", title: "Drafting pipeline" },
      ]}
      showStatus
    />
  ),
};

export const RunningState: Story = {
  render: () => (
    <>
      <RunStatusCard costLabel="14.6s · $0.14" subtitle="step 3/5" title="job_8f2a" />
      <SelfHealCard
        open
        steps={[
          { label: "① 8k chunk → context overflow on file 3." },
          { label: "② Switched to 4k chunk → succeeded.", tone: "success" },
        ]}
        subtitle="round 2"
        title="Self-healed the Parse step"
      />
      <ErrorCard
        title="Notion connector needs a token"
        tryLabel="Connect Notion"
        what="The Export step can't reach your study DB yet."
        why="The connector is not authorized."
        onAction={() => {}}
      />
    </>
  ),
};

export const DoneState: Story = {
  render: () => (
    <>
      <CompletionCard subtitle="$0.31" title="Done in 41.3s">
        Exported 20 vocabulary + grammar questions to Notion. Verify caught 3 weak distractors.
      </CompletionCard>
      <DistillCard
        subtitle="open in Components"
        title="Saved as a Pipeline Skill"
        onOpen={() => {}}
      />
    </>
  ),
};

export const EmptySuggestions: Story = {
  render: () => (
    <SuggestionList
      items={[
        { id: "quiz", label: "Turn my textbook PDFs into a Notion quiz" },
        { id: "changelog", label: "Summarize a GitHub repo into a changelog" },
        { id: "reverse", label: "Upload a finished sample → reverse-engineer it", reverse: true },
      ]}
    />
  ),
};

export const ClarifyPhase: StoryObj = {
  name: "Clarify options",
  render: () => (
    <div className="space-y-2">
      <Assistant>你想处理哪种输入？</Assistant>
      <ClarifyOptions options={["本地文件夹", "GitHub 仓库", "纯文本指令"]} onSelect={() => {}} />
    </div>
  ),
};

export const ErrorRecovery: StoryObj = {
  name: "Error actions",
  render: () => (
    <div className="space-y-2">
      <Assistant>配置的 Agent runtime 在本机不可用，无法生成提案。</Assistant>
      <ErrorActions code="RUNTIME_NOT_FOUND" onOpenSettings={() => {}} onRetry={() => {}} />
      <Assistant>Agent 没有响应。</Assistant>
      <ErrorActions code="AGENT_FAILED" onOpenSettings={() => {}} onRetry={() => {}} />
    </div>
  ),
};

export const MessageHoverActions: StoryObj = {
  name: "Message hover actions (hover a turn)",
  render: () => (
    <div className="space-y-3">
      <div className="group/turn relative space-y-1">
        <Bubble>把一个 GitHub 仓库的代码总结成一份变更日志文档</Bubble>
        <MessageActions
          align="right"
          content="把一个 GitHub 仓库的代码总结成一份变更日志文档"
          onEdit={() => {}}
          onRetry={() => {}}
        />
      </div>
      <div className="group/turn relative space-y-1">
        <Assistant>已为你搭好这条流水线，共 3 个节点。</Assistant>
        <MessageActions align="left" content="已为你搭好这条流水线，共 3 个节点。" />
      </div>
    </div>
  ),
};
