import type { Meta, StoryObj } from "@storybook/react";
import { Refine, type DataProvider } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import type { PipelineData } from "@repo/schemas";
import { CanvasStoreProvider } from "./_store/canvasStore";
import { fromPipelineSnapshot } from "./_store/canvasTypes";
import { CanvasRoot } from "./CanvasRoot";

const emptyPipeline = {
  createdAt: new Date("2026-06-11T00:00:00.000Z"),
  description: "",
  edges: [],
  id: "pipeline-story-empty",
  name: "Canvas V2 Story",
  nodes: [],
  projectId: null,
  status: "draft",
  tags: [],
  timeoutMs: null,
  updatedAt: new Date("2026-06-11T00:00:00.000Z"),
  version: 1,
} satisfies PipelineData;

const withNodesPipeline = {
  ...emptyPipeline,
  edges: [
    {
      data: { label: "document" },
      id: "edge-file-op",
      source: "node-file",
      target: "node-op",
    },
  ],
  id: "pipeline-story-nodes",
  nodes: [
    {
      data: {
        filePath: "src/source.ts",
        label: "Source file",
        language: "typescript",
        nodeType: "file",
      },
      id: "node-file",
      position: { x: 0, y: 0 },
      type: "file",
    },
    {
      data: {
        config: {},
        label: "Parse",
        nodeType: "operation",
        operationId: "op-parse",
        operationName: "Parse",
        status: "idle",
      },
      id: "node-op",
      position: { x: 320, y: 0 },
      type: "operation",
    },
  ],
} satisfies PipelineData;

const storyDataProvider = {
  create: async () => ({ data: {} }),
  deleteOne: async () => ({ data: {} }),
  getApiUrl: () => "http://localhost",
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: {} }),
  update: async () => ({ data: {} }),
} as unknown as DataProvider;

const renderStory = (pipeline: PipelineData) => {
  const snapshot = fromPipelineSnapshot({ edges: pipeline.edges, nodes: pipeline.nodes });

  return (
    <Refine dataProvider={storyDataProvider} options={{ disableTelemetry: true }}>
      <ReactFlowProvider>
        <CanvasStoreProvider edges={snapshot.edges} nodes={snapshot.nodes}>
          <div className="h-[620px] w-full bg-background">
            <CanvasRoot pipeline={pipeline} />
          </div>
        </CanvasStoreProvider>
      </ReactFlowProvider>
    </Refine>
  );
};

const meta: Meta<typeof CanvasRoot> = {
  title: "WorkspacePage/CanvasV2/Root",
  component: CanvasRoot,
};

export default meta;

type Story = StoryObj<typeof CanvasRoot>;

export const Empty: Story = {
  render: () => renderStory(emptyPipeline),
};

export const WithNodes: Story = {
  render: () => renderStory(withNodesPipeline),
};
