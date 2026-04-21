import type { Meta, StoryObj } from "@storybook/react";
import { PipelineDetailPageContent } from "./PipelineDetailPageContent";

const meta: Meta<typeof PipelineDetailPageContent> = {
  title: "Pages/PipelinesPage/PipelineDetailPageContent",
  component: PipelineDetailPageContent,
};

export default meta;
type Story = StoryObj<typeof PipelineDetailPageContent>;

export const Default: Story = {};
