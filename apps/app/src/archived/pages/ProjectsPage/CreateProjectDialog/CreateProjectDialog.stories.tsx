import type { Meta, StoryObj } from "@storybook/react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { ProjectsPageStoreProvider } from "../_store";

const meta: Meta<typeof CreateProjectDialog> = {
  title: "Pages/ProjectsPage/CreateProjectDialog",
  component: CreateProjectDialog,
  decorators: [
    (Story) => (
      <ProjectsPageStoreProvider>
        <Story />
      </ProjectsPageStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CreateProjectDialog>;

export const Default: Story = {};
