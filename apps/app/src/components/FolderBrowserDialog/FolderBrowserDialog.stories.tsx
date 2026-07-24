import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine, type DataProvider } from "@refinedev/core";
import { FolderBrowserDialog } from "./FolderBrowserDialog";

const mockEntries = [
  { name: "Documents", path: "/home/user/Documents", type: "directory" },
  { name: "Projects", path: "/home/user/Projects", type: "directory" },
  { name: "notes.md", path: "/home/user/notes.md", type: "file" },
];

const mockDataProvider = {
  getList: async () => ({ data: mockEntries, total: mockEntries.length }),
  getApiUrl: () => "",
} as unknown as DataProvider;

const FolderBrowserStory = (args: React.ComponentProps<typeof FolderBrowserDialog>) => {
  const [open, setOpen] = useState(args.open);
  const handleOpenChange = (value: boolean) => setOpen(value);
  const handleSelect = (path: string) => {
    args.onSelect(path);
    setOpen(false);
  };

  return (
    <FolderBrowserDialog
      {...args}
      open={open}
      onOpenChange={handleOpenChange}
      onSelect={handleSelect}
    />
  );
};

const meta: Meta<typeof FolderBrowserDialog> = {
  title: "CanvasPage/OutputLocalPathNode/FolderBrowser",
  component: FolderBrowserDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    mode: "folder",
    onOpenChange: () => undefined,
    onSelect: () => undefined,
  },
  decorators: [
    (Story) => (
      <Refine dataProvider={mockDataProvider}>
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
type Story = StoryObj<typeof FolderBrowserDialog>;

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
