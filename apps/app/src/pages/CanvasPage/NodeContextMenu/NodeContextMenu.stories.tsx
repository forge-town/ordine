import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { createHarnessCanvasStore, HarnessCanvasStoreContext, type PipelineNode } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { NodeContextMenu } from "./NodeContextMenu";

const sourceNode = {
  id: "node-1",
  type: "file",
  position: { x: 80, y: 120 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "Pipeline source",
  },
} as PipelineNode;

const meta: Meta<typeof NodeContextMenu> = {
  title: "CanvasPage/NodeContextMenu",
  component: NodeContextMenu,
  tags: ["autodocs"],
  decorators: [
    (Story) => {
      const store = createHarnessCanvasStore([sourceNode], []);
      store.setState({
        nodeContextMenu: { screenX: 220, screenY: 120, nodeId: sourceNode.id },
        selectedNodeId: sourceNode.id,
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
          "Node-level context menu for duplicating, deleting, grouping, ungrouping, and adding compatible downstream nodes from a selected Canvas node.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof NodeContextMenu>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Open node context menu for a selected file node with downstream actions available.",
      },
    },
  },
};
