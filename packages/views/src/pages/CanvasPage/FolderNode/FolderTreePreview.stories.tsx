import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { canvasStoryDataProvider } from "../storybookData";
import { FolderTreePreview } from "./FolderTreePreview";

const meta: Meta<typeof FolderTreePreview> = {
  title: "CanvasPage/FolderNode/FolderTreePreview",
  component: FolderTreePreview,
  tags: ["autodocs"],
  args: {
    folderPath: "/workspace/ordine",
    excludedPaths: ["packages"],
    onExclude: () => undefined,
  },
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <div className="w-80 p-6">
          <Story />
        </div>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Compact folder preview embedded inside project and folder nodes, including excluded directory affordances.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FolderTreePreview>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Folder preview with one path already excluded.",
      },
    },
  },
};

export const EmptyPath: Story = {
  args: {
    folderPath: "",
    excludedPaths: [],
  },
  parameters: {
    docs: {
      description: {
        story: "No preview is rendered until a folder path is available.",
      },
    },
  },
};
