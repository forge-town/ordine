import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { GitHubConnectDialog } from "./GitHubConnectDialog";

const GitHubConnectDialogStory = (args: React.ComponentProps<typeof GitHubConnectDialog>) => {
  const [open, setOpen] = useState(args.open);
  const handleClose = () => setOpen(false);

  return <GitHubConnectDialog {...args} open={open} onClose={handleClose} />;
};

const meta: Meta<typeof GitHubConnectDialog> = {
  title: "CanvasPage/GitHubProjectNode/GitHubConnectDialog",
  component: GitHubConnectDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    initialUrl: "https://github.com/woodfish/ordine",
    onClose: () => undefined,
    onConnect: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[28rem] p-6">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Dialog for connecting a GitHub repository by URL. The Storybook story stops before network verification.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GitHubConnectDialog>;

export const Open: Story = {
  render: (args) => <GitHubConnectDialogStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "URL-entry step for connecting a repository.",
      },
    },
  },
};
