import type { Meta, StoryObj } from "@storybook/react";
import { PipelineCard } from "./PipelineCard";
import type { PipelineEntity } from "@repo/models";

const mockPipeline = {
  id: "pipe-001",
  name: "测试 Pipeline",
  description: "用于测试的示例 Pipeline",
  tags: ["test"],
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as unknown as PipelineEntity;

const meta: Meta<typeof PipelineCard> = {
  title: "Pages/PipelinesPage/PipelineCard",
  component: PipelineCard,
  args: {
    onOpen: () => {},
    onDelete: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof PipelineCard>;

export const Default: Story = {
  args: { pipeline: mockPipeline },
};
