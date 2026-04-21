import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineRecord } from "@repo/db-schema";
import { PipelineSchema } from "@repo/pipeline-engine/schemas";
import { PipelineRow } from "./PipelineRow";

const mockPipelineInput = PipelineSchema.parse({
  id: "pipe-001",
  name: "CI Pipeline",
  description: "持续集成流水线",
  tags: [],
  timeoutMs: null,
  nodes: [],
  edges: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const mockPipeline: PipelineRecord = {
  ...mockPipelineInput,
  createdAt: new Date(mockPipelineInput.createdAt),
  updatedAt: new Date(mockPipelineInput.updatedAt),
};

const meta: Meta<typeof PipelineRow> = {
  title: "Pages/ProjectWorkspacePage/PipelineRow",
  component: PipelineRow,
  args: { onSelect: () => {} },
};

export default meta;
type Story = StoryObj<typeof PipelineRow>;

export const Default: Story = {
  args: { pipeline: mockPipeline, selected: false },
};

export const Selected: Story = {
  args: { pipeline: mockPipeline, selected: true },
};
