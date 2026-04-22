import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { PipelineSchema } from "@repo/pipeline-engine/schemas";
import { PipelineCard } from "./PipelineCard";

const mockPipelineInput = PipelineSchema.parse({
  id: "pipe-001",
  name: "测试 Pipeline",
  description: "用于测试的示例 Pipeline",
  tags: ["test"],
  timeoutMs: null,
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const mockPipeline: PipelineData = {
  ...mockPipelineInput,
  createdAt: new Date(mockPipelineInput.createdAt),
  updatedAt: new Date(mockPipelineInput.updatedAt),
};

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
