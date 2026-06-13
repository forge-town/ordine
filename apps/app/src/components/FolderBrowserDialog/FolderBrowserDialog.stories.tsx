import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine, type DataProvider, type GetListParams } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { FolderBrowserDialog } from "./FolderBrowserDialog";

// H3-05：自包含 mock 文件系统数据源，替代原先对已归档 storybookData 的依赖。
// FolderBrowserDialog 只用 useList({ resource: filesystem })，故仅需 getList。
const STORY_FILESYSTEM = [
  { name: "apps", type: "directory", path: "/workspace/ordine/apps" },
  { name: "packages", type: "directory", path: "/workspace/ordine/packages" },
  { name: "README.md", type: "file", path: "/workspace/ordine/README.md" },
  { name: "app", type: "directory", path: "/workspace/ordine/apps/app" },
  { name: "server", type: "directory", path: "/workspace/ordine/apps/server" },
  { name: "src", type: "directory", path: "/workspace/ordine/apps/app/src" },
  { name: "package.json", type: "file", path: "/workspace/ordine/apps/app/package.json" },
];

const getFilterPath = (params: GetListParams): string | undefined => {
  const filter = (params.filters ?? []).find(
    (item) => "field" in item && item.field === "path",
  );

  return filter && "value" in filter ? (filter.value as string | undefined) : undefined;
};

const storyDataProvider = {
  getList: (params: GetListParams) => {
    if (params.resource !== ResourceName.filesystem) {
      return Promise.resolve({ data: [], total: 0 });
    }
    const path = getFilterPath(params);
    const data = path
      ? STORY_FILESYSTEM.filter((entry) => entry.path.startsWith(path))
      : STORY_FILESYSTEM;

    return Promise.resolve({ data, total: data.length });
  },
  getOne: () => Promise.resolve({ data: { id: "" } }),
  create: () => Promise.resolve({ data: { id: "" } }),
  update: () => Promise.resolve({ data: { id: "" } }),
  deleteOne: () => Promise.resolve({ data: { id: "" } }),
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
      <Refine dataProvider={storyDataProvider}>
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
