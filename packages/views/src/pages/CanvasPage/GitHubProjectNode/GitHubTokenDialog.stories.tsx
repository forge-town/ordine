import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { GitHubTokenDialog } from "./GitHubTokenDialog";

const GitHubTokenDialogStory = (args: React.ComponentProps<typeof GitHubTokenDialog>) => {
  const [open, setOpen] = useState(args.open);
  const handleClose = () => setOpen(false);

  return <GitHubTokenDialog {...args} open={open} onClose={handleClose} />;
};

const meta: Meta<typeof GitHubTokenDialog> = {
  title: "CanvasPage/GitHubProjectNode/GitHubTokenDialog",
  component: GitHubTokenDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    onClose: () => undefined,
    onTokenSaved: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[30rem] p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: "Dialog for storing a GitHub Personal Access Token in local browser storage.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GitHubTokenDialog>;

export const Open: Story = {
  render: (args) => <GitHubTokenDialogStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Token-entry dialog before verification or save actions.",
      },
    },
  },
};
