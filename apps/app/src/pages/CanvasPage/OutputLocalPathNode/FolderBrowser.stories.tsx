import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { canvasStoryDataProvider } from "../storybookData";
import { FolderBrowser } from "./FolderBrowser";

const FolderBrowserStory = (args: React.ComponentProps<typeof FolderBrowser>) => {
  const [open, setOpen] = useState(args.open);
  const handleOpenChange = (value: boolean) => setOpen(value);
  const handleSelect = (path: string) => {
    args.onSelect(path);
    setOpen(false);
  };

  return (
    <FolderBrowser {...args} open={open} onOpenChange={handleOpenChange} onSelect={handleSelect} />
  );
};

const meta: Meta<typeof FolderBrowser> = {
  title: "CanvasPage/OutputLocalPathNode/FolderBrowser",
  component: FolderBrowser,
  tags: ["autodocs"],
  args: {
    open: true,
    mode: "folder",
    onOpenChange: () => undefined,
    onSelect: () => undefined,
  },
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <div className="relative min-h-[28rem] p-6">
          <Story />
        </div>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Dialog used by local output nodes and local project selection to browse folders or files.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FolderBrowser>;

export const FolderMode: Story = {
  render: (args) => <FolderBrowserStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Folder-selection mode using mocked filesystem entries.",
      },
    },
  },
};

export const FileMode: Story = {
  args: {
    mode: "file",
  },
  render: (args) => <FolderBrowserStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "File-selection mode showing files and folders together.",
      },
    },
  },
};
