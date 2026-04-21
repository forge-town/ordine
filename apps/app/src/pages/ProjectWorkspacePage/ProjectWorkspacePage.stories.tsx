import type { Meta, StoryObj } from "@storybook/react";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

const meta: Meta<typeof ProjectWorkspacePage> = {
  title: "Pages/ProjectWorkspacePage",
  component: ProjectWorkspacePage,
};

export default meta;
type Story = StoryObj<typeof ProjectWorkspacePage>;

export const Default: Story = {};
