import type { Meta, StoryObj } from "@storybook/react";
import { PipelineCard } from "./PipelineCard";

const meta: Meta<typeof PipelineCard> = {
  title: "Pages/PipelinesPage/PipelineCard",
  component: PipelineCard,
  args: {},
};

export default meta;
type Story = StoryObj<typeof PipelineCard>;

export const Default: Story = {
  args: {
    pipeline: {
      id: "pipe-001",
      name: "Release pipeline",
      description: "Build, test, and publish the current release.",
      sharedContext: "",
      tags: ["release"],
      timeoutMs: null,
      projectId: "project-1",
      status: "ready",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      nodes: [],
      edges: [],
    },
    metrics: {
      totalRuns: 28,
      successRate: 0.93,
      avgDurationMs: 42_000,
      isSavedSkill: true,
      isScheduled: true,
    },
  },
};
