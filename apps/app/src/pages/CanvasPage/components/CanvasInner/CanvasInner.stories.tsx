import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CanvasInner } from "./CanvasInner";

const meta: Meta<typeof CanvasInner> = {
  title: "CanvasPage/CanvasInner",
  component: CanvasInner,
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
type Story = StoryObj<typeof CanvasInner>;
export const Default: Story = { args: {} };
