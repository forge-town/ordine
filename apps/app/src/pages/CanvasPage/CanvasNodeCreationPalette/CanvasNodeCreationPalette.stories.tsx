import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasNodeCreationPalette } from "./CanvasNodeCreationPalette";

const meta: Meta<typeof CanvasNodeCreationPalette> = {
  title: "CanvasPage/CanvasNodeCreationPalette",
  component: CanvasNodeCreationPalette,
  tags: ["autodocs"],
  args: {
    getCreateNodeScreenPosition: () => ({ x: 640, y: 360 }),
  },
  decorators: [
    (Story) => {
      const store = createHarnessCanvasStore();
      store.setState({
        isQuickAddOpen: true,
        screenToFlowPosition: (position) => position,
      });

      return (
        <Refine dataProvider={canvasStoryDataProvider}>
          <HarnessCanvasStoreContext.Provider value={store}>
            <div className="relative h-[32rem] w-full bg-slate-50">
              <Story />
            </div>
          </HarnessCanvasStoreContext.Provider>
        </Refine>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Toolbar quick-add dialog for creating object nodes, Operations, and Recipes at the current viewport center. Stories use local mock Refine data so the menu is stable without a running API.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasNodeCreationPalette>;

export const Open: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Open quick-add menu with object nodes, mocked Operations, and mocked Recipes.",
      },
    },
  },
};
