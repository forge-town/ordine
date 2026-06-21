import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import type { PipelineData } from "@repo/schemas";
import { CanvasPageStoreProvider } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasFlow } from "./CanvasFlow";

const portAlignmentPipeline: PipelineData = {
  id: "story-port-alignment",
  name: "Port Alignment Debug",
  description: "Debug fixture for React Flow handle alignment.",
  tags: ["storybook", "debug"],
  timeoutMs: null,
  createdAt: new Date("2026-04-08T16:00:00.000Z"),
  updatedAt: new Date("2026-04-08T16:00:00.000Z"),
  nodes: [
    {
      id: "story-file-source",
      type: "file",
      position: { x: 80, y: 140 },
      data: {
        nodeType: "file",
        label: "README.md",
        filePath: "README.md",
        language: "markdown",
        description: "Source file for the debug connection.",
      },
    },
    {
      id: "story-review-target",
      type: "operation",
      position: { x: 460, y: 140 },
      data: {
        nodeType: "operation",
        label: "Review Code",
        operationId: "review-code",
        operationName: "Review Code",
        status: "idle",
        config: {},
      },
    },
  ],
  edges: [],
};

const meta: Meta<typeof CanvasFlow> = {
  title: "CanvasPage/CanvasFlow",
  component: CanvasFlow,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <CanvasPageStoreProvider pipeline={context.parameters.canvasPipeline ?? null}>
          <ReactFlowProvider>
            <div className="h-[640px] w-full">
              <Story />
            </div>
          </ReactFlowProvider>
        </CanvasPageStoreProvider>
      </Refine>
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

export const PortAlignmentDebug: Story = {
  args: {},
  parameters: {
    canvasPipeline: portAlignmentPipeline,
    docs: {
      description: {
        story:
          "Two-node React Flow fixture for checking that draggable connection previews start and end on the visible NodeCard ports.",
      },
    },
  },
};
