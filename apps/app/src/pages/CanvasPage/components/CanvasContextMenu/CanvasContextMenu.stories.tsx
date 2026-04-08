import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CanvasContextMenu } from "./CanvasContextMenu";

const meta: Meta<typeof CanvasContextMenu> = {
  title: "CanvasPage/CanvasContextMenu",
  component: CanvasContextMenu,
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
type Story = StoryObj<typeof CanvasContextMenu>;
export const Default: Story = { args: {} };
