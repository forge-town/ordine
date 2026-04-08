import type { Meta, StoryObj } from "@storybook/react";
import { ProjectDetailPageContent } from "./ProjectDetailPageContent";

const meta: Meta<typeof ProjectDetailPageContent> = {
  title: "Pages/ProjectDetailPage/ProjectDetailPageContent",
  component: ProjectDetailPageContent,
};

export default meta;
type Story = StoryObj<typeof ProjectDetailPageContent>;

export const Default: Story = {};
