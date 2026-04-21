import type { Meta, StoryObj } from "@storybook/react";
import { ProjectWorkspacePageContent } from "./ProjectWorkspacePageContent";

const meta: Meta<typeof ProjectWorkspacePageContent> = {
  title: "Pages/ProjectWorkspacePage/ProjectWorkspacePageContent",
  component: ProjectWorkspacePageContent,
};

export default meta;
type Story = StoryObj<typeof ProjectWorkspacePageContent>;

export const Default: Story = {};
