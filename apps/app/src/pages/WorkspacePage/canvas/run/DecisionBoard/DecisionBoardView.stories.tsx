import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DecisionBoardView } from "./DecisionBoardView";
import type { DecisionCandidate } from "./DecisionCandidateCard";

const candidates: DecisionCandidate[] = [
  {
    nodeId: "gen-a",
    label: "Variant A · Editorial",
    content:
      '<main style="font-family:system-ui;padding:20px"><h1>Editorial</h1><p>Serif-led, calm.</p></main>',
  },
  {
    nodeId: "gen-b",
    label: "Variant B · Brutalist",
    content:
      "# Brutalist\n\nRaw grid, **mono** type, hard edges.\n\n- high contrast\n- utilitarian",
  },
  {
    nodeId: "gen-c",
    label: "Variant C · Tokens",
    content: '{\n  "color": { "primary": "#f43f5e" },\n  "radius": 12\n}',
  },
];

const meta: Meta<typeof DecisionBoardView> = {
  title: "WorkspacePage/CanvasV2/Run/DecisionBoard",
  component: DecisionBoardView,
  decorators: [
    (Story) => (
      <div className="relative h-[640px] w-full overflow-hidden rounded-xl bg-surface-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof DecisionBoardView>;

const Interactive = ({ selectMode }: { selectMode: "single" | "multi" }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const onToggle = (candidateId: string) =>
    setSelectedIds((current) => {
      if (selectMode === "single") {
        return current[0] === candidateId ? [] : [candidateId];
      }

      return current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId];
    });

  return (
    <DecisionBoardView
      nodeLabel="Pick a design direction"
      instruction="Pick the direction that best fits a calm, editorial product."
      selectMode={selectMode}
      candidates={candidates}
      selectedIds={selectedIds}
      submitting={false}
      onToggle={onToggle}
      onConfirm={() => {}}
    />
  );
};

export const SingleSelect: Story = {
  render: () => <Interactive selectMode="single" />,
};

export const MultiSelect: Story = {
  render: () => <Interactive selectMode="multi" />,
};

export const Empty: Story = {
  args: {
    nodeLabel: "Pick a design direction",
    selectMode: "single",
    candidates: [],
    selectedIds: [],
    submitting: false,
    onToggle: () => {},
    onConfirm: () => {},
  },
};
