import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasFloatingMenu } from "./CanvasFloatingMenu";

const meta: Meta<typeof CanvasFloatingMenu> = {
  title: "CanvasPage/CanvasFloatingMenu",
  component: CanvasFloatingMenu,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Floating Canvas persistence controls for the current pipeline, including save/create affordances and run-console toggles.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasFloatingMenu>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Default floating menu with no loaded pipeline.",
      },
    },
  },
};
