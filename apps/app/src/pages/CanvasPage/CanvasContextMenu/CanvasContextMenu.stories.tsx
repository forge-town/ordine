import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasContextMenu } from "./CanvasContextMenu";

const meta: Meta<typeof CanvasContextMenu> = {
  title: "CanvasPage/CanvasContextMenu",
  component: CanvasContextMenu,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const store = createHarnessCanvasStore();
      store.setState({
        contextMenu: { screenX: 200, screenY: 120, flowX: 100, flowY: 80 },
      });

      return (
        <Refine dataProvider={canvasStoryDataProvider}>
          <HarnessCanvasStoreContext.Provider value={store}>
            <div className="relative h-96 w-full bg-slate-50">
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
          "Blank-canvas context menu for creating object nodes, Operation nodes, Recipes, and compound groups at the pointer position.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasContextMenu>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Open blank-canvas context menu backed by local Operation and Recipe story data.",
      },
    },
  },
};
