import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import {
  createHarnessCanvasStore,
  HarnessCanvasStoreContext,
  type PipelineEdge,
  type PipelineNode,
} from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { RunConsole } from "./RunConsole";

const sourceNode = {
  id: "source-file",
  type: "code-file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "code-file",
    filePath: "src/index.ts",
    language: "typescript",
  },
} as PipelineNode;

const operationNode = {
  id: "review-op",
  type: "operation",
  position: { x: 320, y: 0 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "running",
    config: {},
  },
} as PipelineNode;

const edge = {
  id: "source-to-review",
  source: "source-file",
  target: "review-op",
  type: "default",
  data: {},
} as PipelineEdge;

const withRunConsoleStore = (Story: React.ComponentType) => {
  const store = createHarnessCanvasStore([sourceNode, operationNode], [edge]);
  store.setState({
    activeJobId: "job-story",
    isConsoleOpen: true,
    isTestRunning: true,
    runningNodeId: "review-op",
    nodeRunStatuses: { "review-op": "running" },
  });

  return (
    <Refine dataProvider={canvasStoryDataProvider}>
      <HarnessCanvasStoreContext.Provider value={store}>
        <div className="relative h-80 w-full overflow-hidden rounded-md border bg-slate-50">
          <Story />
        </div>
      </HarnessCanvasStoreContext.Provider>
    </Refine>
  );
};

const meta: Meta<typeof RunConsole> = {
  title: "CanvasPage/RunConsole",
  component: RunConsole,
  tags: ["autodocs"],
  decorators: [withRunConsoleStore],
  parameters: {
    docs: {
      description: {
        component:
          "Bottom run console for active pipeline jobs. Storybook uses mocked `jobs` and `jobs/traces` responses, so the console can render in Docs without a backend.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RunConsole>;

export const Running: Story = {
  parameters: {
    docs: {
      description: {
        story: "Console open with a running job, visible logs, and structured node status updates.",
      },
    },
  },
};
