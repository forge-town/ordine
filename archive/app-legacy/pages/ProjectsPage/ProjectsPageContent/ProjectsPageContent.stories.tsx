import type { Meta, StoryObj } from "@storybook/react";
import { ProjectsPageContent } from "./ProjectsPageContent";
import { ProjectsPageStoreProvider } from "../_store";

const meta: Meta<typeof ProjectsPageContent> = {
  title: "Pages/ProjectsPage/ProjectsPageContent",
  component: ProjectsPageContent,
  decorators: [
    (Story) => (
      <ProjectsPageStoreProvider>
        <Story />
      </ProjectsPageStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof ProjectsPageContent>;

export const Default: Story = {};
