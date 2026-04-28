import type { Meta, StoryObj } from "@storybook/react";
import { ObjectRow } from "./ObjectRow";
import { ProjectWorkspacePageStoreProvider } from "../_store";

const meta: Meta<typeof ObjectRow> = {
  title: "Pages/ProjectWorkspacePage/ObjectRow",
  component: ObjectRow,
  decorators: [
    (Story) => (
      <ProjectWorkspacePageStoreProvider>
        <Story />
      </ProjectWorkspacePageStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ObjectRow>;

export const Default: Story = {
  args: {
    item: { type: "file", path: "/src/main.ts", label: "src/main.ts" },
    selected: false,
  },
};

export const Selected: Story = {
  args: {
    item: { type: "folder", path: "src/", label: "src/" },
    selected: true,
  },
};
