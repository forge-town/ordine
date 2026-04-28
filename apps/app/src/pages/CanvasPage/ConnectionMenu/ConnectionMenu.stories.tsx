import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import type { PipelineNode } from "../_store";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { ConnectionMenu } from "./ConnectionMenu";

const sourceNode = {
  id: "source-file",
  type: "code-file",
  position: { x: 80, y: 120 },
  data: {
    label: "Source File",
    nodeType: "code-file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "Pipeline source",
  },
} as PipelineNode;

const meta: Meta<typeof ConnectionMenu> = {
  title: "CanvasPage/ConnectionMenu",
  component: ConnectionMenu,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const store = createHarnessCanvasStore([sourceNode], []);
      store.setState({
        connectStart: { nodeId: sourceNode.id, handleId: null, handleType: "source" },
        connectionMenu: { screenX: 220, screenY: 120, flowX: 180, flowY: 120 },
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
          "Connection-end menu shown after dragging from a node handle to empty canvas space. It offers compatible target node types, Operations, Recipes, and output endpoints.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ConnectionMenu>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          "Open connection menu from a code-file source node using local Operation and Recipe data.",
      },
    },
  },
};
