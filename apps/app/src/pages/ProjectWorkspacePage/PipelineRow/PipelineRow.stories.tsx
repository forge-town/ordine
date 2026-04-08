import type { Meta, StoryObj } from "@storybook/react";
import { PipelineRow } from "./PipelineRow";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";

const mockPipeline = {
  id: "pipe-001",
  name: "CI Pipeline",
  description: "持续集成流水线",
} as unknown as PipelineEntity;

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
