import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineData } from "@repo/schemas";
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
} satisfies PipelineData;

const meta: Meta<typeof CanvasRoot> = {
  title: "WorkspacePage/CanvasV2/Root",
  component: CanvasRoot,
  decorators: [
    (Story) => (
      <div className="h-[620px] w-full bg-background">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CanvasRoot>;

export const Empty: Story = {
  args: {
    pipeline: emptyPipeline,
  },
};

export const WithNodes: Story = {
  args: {
    pipeline: {
      ...emptyPipeline,
      edges: [
        {
          data: { label: "document" },
          id: "edge-file-op",
          source: "node-file",
          target: "node-op",
        },
      ],
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
    },
  },
};
