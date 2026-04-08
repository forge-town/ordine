import type { Meta, StoryObj } from "@storybook/react";
import { PipelineDetailPage } from "./PipelineDetailPage";

const meta: Meta<typeof PipelineDetailPage> = {
  title: "Pages/PipelinesPage/PipelineDetailPage",
  component: PipelineDetailPage,
};

export default meta;
type Story = StoryObj<typeof PipelineDetailPage>;

export const Default: Story = {};
