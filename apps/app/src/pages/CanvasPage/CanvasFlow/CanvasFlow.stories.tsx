import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasFlow } from "./CanvasFlow";

const meta: Meta<typeof CanvasFlow> = {
  title: "CanvasPage/CanvasFlow",
  component: CanvasFlow,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <ReactFlowProvider>
          <Story />
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CanvasFlow>;
export const Default: Story = { args: {} };
