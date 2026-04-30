import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasFlow } from "./CanvasFlow";

const meta: Meta<typeof CanvasFlow> = {
  title: "CanvasPage/CanvasFlow",
  component: CanvasFlow,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <ReactFlowProvider>
          <Story />
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "React Flow surface for Canvas nodes, edges, controls, default viewport, zoom tracking, and MiniMap visibility.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasFlow>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Empty flow surface using the shared default viewport configuration.",
      },
    },
  },
};
