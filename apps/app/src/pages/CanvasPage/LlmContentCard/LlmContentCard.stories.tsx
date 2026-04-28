import type { Meta, StoryObj } from "@storybook/react";
import { createHarnessCanvasStore, HarnessCanvasStoreContext, type PipelineNode } from "../_store";
import { LlmContentCard } from "./LlmContentCard";

const operationNode = {
  id: "review-op",
  type: "operation",
  position: { x: 0, y: 0 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "running",
    config: {},
  },
} as PipelineNode;

const withInspectionStore = (Story: React.ComponentType) => {
  const store = createHarnessCanvasStore([operationNode]);
  store.setState({
    inspectingNodeId: "review-op",
    nodeRunStatuses: { "review-op": "running" },
    nodeLlmContent: {
      "review-op":
        "### Review\n\n- No blocking issue in this story.\n- Add focused tests before merging behavior changes.",
    },
  });

  return (
    <HarnessCanvasStoreContext.Provider value={store}>
      <div className="relative h-96 w-full rounded-md border bg-slate-50">
        <Story />
      </div>
    </HarnessCanvasStoreContext.Provider>
  );
};

const meta: Meta<typeof LlmContentCard> = {
  title: "CanvasPage/LlmContentCard",
  component: LlmContentCard,
  tags: ["autodocs"],
  decorators: [withInspectionStore],
  parameters: {
    docs: {
      description: {
        component:
          "Floating inspector card for LLM output captured from a running or completed operation node.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof LlmContentCard>;

export const WithContent: Story = {
  parameters: {
    docs: {
      description: {
        story: "Inspector with markdown content for the active operation node.",
      },
    },
  },
};

export const WaitingForContent: Story = {
  decorators: [
    (Story) => {
      const store = createHarnessCanvasStore([operationNode]);
      store.setState({
        inspectingNodeId: "review-op",
        nodeRunStatuses: { "review-op": "running" },
        nodeLlmContent: {},
      });

      return (
        <HarnessCanvasStoreContext.Provider value={store}>
          <div className="relative h-96 w-full rounded-md border bg-slate-50">
            <Story />
          </div>
        </HarnessCanvasStoreContext.Provider>
      );
    },
  ],
  parameters: {
    docs: {
      description: {
        story: "Running state before the first LLM content chunk arrives.",
      },
    },
  },
};
