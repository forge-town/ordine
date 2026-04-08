import type { Meta, StoryObj } from "@storybook/react";
import { ProjectDetailPage } from "./ProjectDetailPage";

const meta: Meta<typeof ProjectDetailPage> = {
  title: "Pages/ProjectDetailPage",
  component: ProjectDetailPage,
};

export default meta;
type Story = StoryObj<typeof ProjectDetailPage>;

export const Default: Story = {};
