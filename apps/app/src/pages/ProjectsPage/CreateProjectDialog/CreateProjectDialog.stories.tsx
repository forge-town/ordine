import type { Meta, StoryObj } from "@storybook/react";
import { CreateProjectDialog } from "./CreateProjectDialog";

const meta: Meta<typeof CreateProjectDialog> = {
  title: "Pages/ProjectsPage/CreateProjectDialog",
  component: CreateProjectDialog,
  args: {
    onClose: () => {},
    onCreate: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof CreateProjectDialog>;

export const Default: Story = {};
