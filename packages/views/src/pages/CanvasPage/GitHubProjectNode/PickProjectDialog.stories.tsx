import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { canvasStoryDataProvider } from "../storybookData";
import { PickProjectDialog } from "./PickProjectDialog";

const PickProjectDialogStory = (args: React.ComponentProps<typeof PickProjectDialog>) => {
  const [open, setOpen] = useState(args.open);
  const handleClose = () => setOpen(false);

  return <PickProjectDialog {...args} open={open} onClose={handleClose} />;
};

const meta: Meta<typeof PickProjectDialog> = {
  title: "CanvasPage/GitHubProjectNode/PickProjectDialog",
  component: PickProjectDialog,
  tags: ["autodocs"],
  args: {
    open: true,
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
        component:
          "Dialog for selecting an existing GitHub project from the user's project library.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PickProjectDialog>;

export const Open: Story = {
  render: (args) => <PickProjectDialogStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Project library picker populated by Storybook mock GitHub projects.",
      },
    },
  },
};
