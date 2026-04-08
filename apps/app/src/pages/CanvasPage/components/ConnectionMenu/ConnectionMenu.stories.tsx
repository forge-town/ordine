import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { ConnectionMenu } from "./ConnectionMenu";

const meta: Meta<typeof ConnectionMenu> = {
  title: "CanvasPage/ConnectionMenu",
  component: ConnectionMenu,
  args: { screenX: 200, screenY: 200, flowX: 100, flowY: 100, onClose: () => undefined },
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ConnectionMenu>;
export const Default: Story = { args: {} };
