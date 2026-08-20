import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import {
  createCanvasPageStore,
  CanvasPageStoreContext,
  type PipelineEdge,
  type PipelineNode,
} from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { RunConsole } from "./RunConsole";

const sourceNode = {
  id: "source-file",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
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

type RunConsoleState = "loading" | "queued" | "running" | "done" | "failed";

const withRunConsoleStore: Decorator<typeof RunConsole> = (Story, context) => {
  const state = (context.parameters.runConsoleState ?? "running") as RunConsoleState;
  const jobIdByState: Record<RunConsoleState, string | null> = {
    loading: null,
    queued: "job-queued-story",
    running: "job-story",
    done: "job-done-story",
    failed: "job-failed-story",
  };
  const jobId = jobIdByState[state];
  const isRunning = state === "running";
  const store = createCanvasPageStore([sourceNode, operationNode], [edge]);
  store.setState({
    activeJobId: jobId,
    isConsoleOpen: true,
    isTestRunning: isRunning,
    runningNodeId: isRunning ? "review-op" : null,
    nodeRunStatuses: isRunning ? { "review-op": "running" } : {},
  });

  return (
    <Refine dataProvider={canvasStoryDataProvider}>
      <CanvasPageStoreContext.Provider value={store}>
        <div className="relative h-80 w-full overflow-hidden rounded-md border bg-slate-50">
          <Story />
        </div>
      </CanvasPageStoreContext.Provider>
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
    runConsoleState: "running",
    docs: {
      description: {
        story: "Console open with a running job, visible logs, and structured node status updates.",
      },
    },
  },
};

export const Loading: Story = {
  parameters: {
    runConsoleState: "loading",
    docs: {
      description: {
        story: "Console shell mounted before the active develop Job resource has resolved.",
      },
    },
  },
};

export const Queued: Story = {
  parameters: {
    runConsoleState: "queued",
    docs: {
      description: {
        story:
          "Queued Job state before execution begins, using the current develop JobStatus enum.",
      },
    },
  },
};

export const Completed: Story = {
  parameters: {
    runConsoleState: "done",
    docs: {
      description: {
        story:
          "Successful terminal state with an empty timeline, preserving the current run-console layout.",
      },
    },
  },
};

export const Failed: Story = {
  parameters: {
    runConsoleState: "failed",
    docs: {
      description: {
        story: "Failed terminal state with the develop Job error rendered in the console body.",
      },
    },
  },
};
