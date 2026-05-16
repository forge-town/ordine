import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasPageStoreProvider } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasInner } from "./CanvasInner";

const meta: Meta<typeof CanvasInner> = {
  title: "CanvasPage/CanvasInner",
  component: CanvasInner,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <CanvasPageStoreProvider pipeline={null}>
          <ReactFlowProvider>
            <Story />
          </ReactFlowProvider>
        </CanvasPageStoreProvider>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canvas shell that layers the title pill, floating save menu, toolbar, flow surface, empty state, quick add, status bar, context menus, inspection card, and run console.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasInner>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Default empty CanvasInner layout with the empty-state card and status bar visible.",
      },
    },
  },
};
