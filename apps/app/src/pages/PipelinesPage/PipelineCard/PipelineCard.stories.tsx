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
  args: { pipelineId: "pipe-001" },
};
