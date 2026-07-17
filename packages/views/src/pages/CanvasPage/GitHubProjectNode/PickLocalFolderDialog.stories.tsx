import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { canvasStoryDataProvider } from "../storybookData";
import { PickLocalFolderDialog } from "./PickLocalFolderDialog";

const PickLocalFolderDialogStory = (args: React.ComponentProps<typeof PickLocalFolderDialog>) => {
  const [open, setOpen] = useState(args.open);
  const handleClose = () => setOpen(false);

  return <PickLocalFolderDialog {...args} open={open} onClose={handleClose} />;
};

const meta: Meta<typeof PickLocalFolderDialog> = {
  title: "CanvasPage/GitHubProjectNode/PickLocalFolderDialog",
  component: PickLocalFolderDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    initialPath: "/workspace/ordine",
    onClose: () => undefined,
    onPick: () => undefined,
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
        component: "Dialog for binding a project node to a local folder instead of GitHub.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PickLocalFolderDialog>;

export const Open: Story = {
  render: (args) => <PickLocalFolderDialogStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Local folder picker with a prefilled path.",
      },
    },
  },
};
