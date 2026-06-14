import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
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
      const store = createCanvasPageStore();
      store.setState({
        isQuickAddOpen: true,
        screenToFlowPosition: (position) => position,
      });

      return (
        <Refine dataProvider={canvasStoryDataProvider}>
          <CanvasPageStoreContext.Provider value={store}>
            <div className="relative h-[32rem] w-full bg-slate-50">
              <Story />
            </div>
          </CanvasPageStoreContext.Provider>
        </Refine>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Toolbar quick-add dialog for creating object nodes and Operations at the current viewport center. Stories use local mock Refine data so the menu is stable without a running API.",
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
        story: "Open quick-add menu with object nodes and mocked Operations.",
      },
    },
  },
};
