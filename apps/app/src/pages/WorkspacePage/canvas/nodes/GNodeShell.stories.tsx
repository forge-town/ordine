import { ReactFlowProvider } from "@xyflow/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { FileObjectNodeData, OperationNodeData } from "@repo/schemas";
import { CanvasStoreProvider } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { CompoundNode } from "./CompoundNode";
import { FileNode } from "./FileNode";
import { OperationNode } from "./OperationNode";

const fileNodeData = {
  filePath: "src/source.ts",
  label: "Source file",
  language: "typescript",
  nodeType: "file",
} satisfies FileObjectNodeData;

const operationNodeData = {
  label: "Parse PDF",
  nodeType: "operation",
  operationId: "op-parse",
  operationName: "Parse PDF",
  status: "running",
} satisfies OperationNodeData;

const nodes = [
  {
    data: fileNodeData,
    id: "node-file",
    position: { x: 0, y: 0 },
    type: "file",
  },
  {
    data: operationNodeData,
    id: "node-operation",
    position: { x: 260, y: 0 },
    type: "operation",
  },
] satisfies CanvasNode[];

const meta: Meta<typeof OperationNode> = {
  title: "WorkspacePage/CanvasV2/Nodes",
  component: OperationNode,
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <CanvasStoreProvider
          edges={[
            {
              animated: true,
              data: { label: "document" },
              id: "edge-file-operation",
              source: "node-file",
              target: "node-operation",
              type: "semantic",
            },
          ]}
          nodes={nodes}
        >
          <div className="flex min-h-72 items-center justify-center gap-10 bg-surface-2 p-8">
            <Story />
          </div>
        </CanvasStoreProvider>
      </ReactFlowProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof OperationNode>;

export const Operation: Story = {
  args: {
    data: operationNodeData,
    id: "node-operation",
    selected: true,
  },
};

export const FileInput: Story = {
  render: () => <FileNode data={fileNodeData} id="node-file" />,
};

export const Compound: Story = {
  render: () => (
    <CompoundNode
      data={{
        childEdges: [],
        childNodeIds: ["node-file", "node-operation"],
        compoundKind: "verify",
        description: "Generator and verifier loop",
        label: "Verify group",
        nodeType: "compound",
      }}
      id="node-compound"
    />
  ),
};
