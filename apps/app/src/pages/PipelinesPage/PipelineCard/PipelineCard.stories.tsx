import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineData } from "@repo/schemas";
import { PipelineCard } from "./PipelineCard";

const samplePipeline: PipelineData = {
  id: "pipe-001",
  projectId: null,
  version: 1,
  name: "Textbook to Notion Quiz",
  description: "Parse PDFs into vocabulary, grammar questions, verification, and Notion output.",
  status: "ready",
  tags: ["Verify"],
  timeoutMs: null,
  createdAt: new Date("2026-06-10T10:00:00.000Z"),
  updatedAt: new Date("2026-06-10T10:00:00.000Z"),
  nodes: [
    {
      id: "input",
      type: "folder",
      position: { x: 0, y: 0 },
      data: { label: "Folder", nodeType: "folder", folderPath: "~/study" },
    },
    {
      id: "quiz",
      type: "operation",
      position: { x: 160, y: 0 },
      data: {
        label: "Generate Quiz",
        nodeType: "operation",
        operationId: "op-quiz",
        operationName: "Generate Quiz",
        status: "idle",
      },
    },
  ],
  edges: [],
};

const meta: Meta<typeof PipelineCard> = {
  title: "Pages/PipelinesPage/PipelineCard",
  component: PipelineCard,
  args: {
    isSavedSkill: true,
    isScheduled: true,
    pipeline: samplePipeline,
    routineLabel: "Daily review",
    stats: { avgDurationMs: 41_000, runs: 47, successRate: 98 },
    onOpen: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof PipelineCard>;

export const Default: Story = {
  args: {},
};
