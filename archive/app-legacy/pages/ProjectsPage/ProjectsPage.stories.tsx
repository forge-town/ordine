import type { Meta, StoryObj } from "@storybook/react";
import { ProjectsPage } from "./ProjectsPage";

const meta: Meta<typeof ProjectsPage> = {
  title: "Pages/ProjectsPage",
  component: ProjectsPage,
};

export default meta;

type Story = StoryObj<typeof ProjectsPage>;

export const Default: Story = {};
