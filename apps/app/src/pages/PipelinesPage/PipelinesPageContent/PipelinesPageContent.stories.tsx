import type { Meta, StoryObj } from "@storybook/react";
import { PipelinesPageContent } from "./PipelinesPageContent";

const meta: Meta<typeof PipelinesPageContent> = {
  title: "Pages/PipelinesPage/PipelinesPageContent",
  component: PipelinesPageContent,
};

export default meta;
type Story = StoryObj<typeof PipelinesPageContent>;

export const Default: Story = {};
