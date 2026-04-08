import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { NodeContextMenu } from "./NodeContextMenu";

const meta: Meta<typeof NodeContextMenu> = {
  title: "CanvasPage/NodeContextMenu",
  component: NodeContextMenu,
  args: { screenX: 200, screenY: 200, nodeId: "node-1", onClose: () => undefined },
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof NodeContextMenu>;
export const Default: Story = { args: {} };
