import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import type { Operation } from "@repo/schemas";
import { PipelineDetailPageContent } from "./PipelineDetailPageContent";

const mockPipeline: PipelineData = {
  id: "pipeline-1",
  name: "Example Pipeline",
  description: "A sample pipeline for Storybook preview",
  tags: ["example", "storybook"],
  timeoutMs: null,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-02"),
  nodes: [
    {
      id: "node-1",
      type: "operation",
      position: { x: 0, y: 80 },
      data: {
        nodeType: "operation",
        label: "Lint Check",
        operationId: "op-1",
        operationName: "Lint Check",
        status: "idle",
      },
    },
    {
      id: "node-2",
      type: "operation",
      position: { x: 220, y: 80 },
      data: {
        nodeType: "operation",
        label: "Format",
        operationId: "op-2",
        operationName: "Format",
        status: "idle",
      },
    },
  ],
  edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
};

const mockOperations: Operation[] = [
  {
    id: "op-1",
    name: "Lint Check",
    description: null,
    config: { inputs: [], outputs: [] },
    acceptedObjectTypes: ["file"],
  },
  {
    id: "op-2",
    name: "Format",
    description: null,
    config: { inputs: [], outputs: [] },
    acceptedObjectTypes: ["file"],
  },
];

const meta: Meta<typeof PipelineDetailPageContent> = {
  title: "Pages/PipelineDetailPage/PipelineDetailPageContent",
  component: PipelineDetailPageContent,
  args: {
    pipeline: mockPipeline,
    operations: mockOperations,
  },
};

export default meta;
type Story = StoryObj<typeof PipelineDetailPageContent>;

export const Default: Story = {};
