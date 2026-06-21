import type { Meta, StoryObj } from "@storybook/react";
import { AttachMenu } from "./AttachMenu";

const meta: Meta<typeof AttachMenu> = {
  title: "WorkspacePage/AgentBar/Composer/AttachMenu",
  component: AttachMenu,
  decorators: [
    (Story) => (
      <div className="flex h-[180px] items-end bg-surface p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Codex-style '+' attach menu for the Agent Bar composer. Supports attaching files and whole folders; the entries list is the extension point for future sources (connectors, screenshots, …).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AttachMenu>;

export const Default: Story = {
  args: {
    onAttach: (attachments) => {
      console.log("attachments", attachments);
    },
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    onAttach: () => {},
  },
};
