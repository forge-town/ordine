import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import type { OperationNodeData } from "@repo/pipeline-engine/schemas";
import { createHarnessCanvasStore, HarnessCanvasStoreContext, type PipelineNode } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { OperationNode } from "./OperationNode";

const baseData: OperationNodeData = {
  label: "Review Code",
  nodeType: "operation",
  operationId: "review-code",
  operationName: "Review Code",
  status: "idle",
  config: {},
  bestPracticeId: "bp-strict-review",
  bestPracticeName: "Strict Review",
};

const withCanvasProviders = (Story: React.ComponentType, context: { args: OperationNodeProps }) => {
  const nodeId = context.args.id ?? "review-op";
  const node = {
    id: nodeId,
    type: "operation",
    position: { x: 0, y: 0 },
    data: context.args.data ?? baseData,
  } as PipelineNode;
  const store = createHarnessCanvasStore([node]);

  store.setState({
    isTestRunning: context.args.data?.status === "running",
    nodeRunStatuses: context.args.data?.status === "running" ? { [nodeId]: "running" } : {},
  });

  return (
    <Refine dataProvider={canvasStoryDataProvider}>
      <HarnessCanvasStoreContext.Provider value={store}>
        <ReactFlowProvider>
          <div className="p-6">
            <Story />
          </div>
        </ReactFlowProvider>
      </HarnessCanvasStoreContext.Provider>
    </Refine>
  );
};

type OperationNodeProps = React.ComponentProps<typeof OperationNode>;

const meta: Meta<typeof OperationNode> = {
  title: "CanvasPage/OperationNode",
  component: OperationNode,
  tags: ["autodocs"],
  args: {
    id: "review-op",
    data: baseData,
  },
  decorators: [withCanvasProviders],
  parameters: {
    docs: {
      description: {
        component:
          "Operation node used to run a configured operation or recipe. The Docs stories load mocked Operations and Best Practices through the Canvas Storybook data provider.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OperationNode>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Configured operation node with runtime and best-practice selectors.",
      },
    },
  },
};

export const Running: Story = {
  args: {
    data: {
      ...baseData,
      status: "running",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Operation node while a pipeline run is active.",
      },
    },
  },
};

export const LoopEnabled: Story = {
  args: {
    data: {
      ...baseData,
      loopEnabled: true,
      maxLoopCount: 3,
      loopConditionPrompt: "No blocking review findings remain.",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Operation node with retry loop controls expanded.",
      },
    },
  },
};
