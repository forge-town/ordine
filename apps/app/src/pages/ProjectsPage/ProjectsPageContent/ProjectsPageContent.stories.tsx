import type { Meta, StoryObj } from "@storybook/react";
import { ProjectsPageContent } from "./ProjectsPageContent";

const meta: Meta<typeof ProjectsPageContent> = {
  title: "Pages/ProjectsPage/ProjectsPageContent",
  component: ProjectsPageContent,
};

export default meta;

type Story = StoryObj<typeof ProjectsPageContent>;

export const Default: Story = {};
