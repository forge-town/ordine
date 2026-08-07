import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineData } from "@repo/schemas";
import { NotificationStoreProvider } from "@repo/views/store/notificationStore";
import { CanvasRoot } from "./CanvasRoot";

const emptyPipeline = {
  createdAt: new Date("2026-06-11T00:00:00.000Z"),
  description: "",
  edges: [],
  id: "pipeline-story-empty",
  name: "Canvas V2 Story",
  nodes: [],
  sharedContext: "",
  tags: [],
  timeoutMs: null,
  updatedAt: new Date("2026-06-11T00:00:00.000Z"),
} satisfies PipelineData;

const meta: Meta<typeof CanvasRoot> = {
  title: "WorkspacePage/CanvasV2/Root",
  component: CanvasRoot,
  decorators: [
    (Story) => (
      <NotificationStoreProvider>
        <div className="h-[620px] w-full bg-background">
          <Story />
        </div>
      </NotificationStoreProvider>
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
        {
          data: { label: "instruction" },
          id: "edge-prompt-op",
          source: "node-prompt",
          target: "node-op",
        },
        {
          data: { label: "result" },
          id: "edge-op-output",
          source: "node-op",
          target: "node-output",
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
        {
          data: {
            description: "Checks the parsed document",
            label: "Review prompt",
            nodeType: "prompt",
            prompt: "Review {{document}} for correctness.",
          },
          id: "node-prompt",
          position: { x: 0, y: 220 },
          type: "prompt",
        },
        {
          data: {
            description: "Workspace source files",
            folderPath: "src/pages",
            label: "Source folder",
            nodeType: "folder",
          },
          id: "node-folder",
          position: { x: 320, y: 220 },
          type: "folder",
        },
        {
          data: {
            branch: "main",
            description: "Remote project input",
            label: "Ordine repo",
            nodeType: "github-project",
            owner: "forge-town",
            repo: "ordine",
          },
          id: "node-github",
          position: { x: 640, y: 220 },
          type: "github-project",
        },
        {
          data: {
            description: "Generated review report",
            label: "Build output",
            localPath: "dist/result.md",
            nodeType: "output-local-path",
          },
          id: "node-output",
          position: { x: 640, y: 0 },
          type: "output-local-path",
        },
        {
          data: {
            boundaryEdges: [],
            childEdges: [],
            childNodeIds: [],
            compoundKind: "verify",
            description: "Generator and verifier loop",
            label: "Verify group",
            nodeType: "compound",
          },
          id: "node-compound",
          position: { x: 960, y: 110 },
          type: "compound",
        },
      ],
    },
  },
};
