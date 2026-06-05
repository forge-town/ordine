import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type {
  BaseRecord,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
} from "@refinedev/core";
import type {
  AgentRuntimeConfig,
  PipelineActionDiagnostic,
  PipelineActionProposal,
} from "@repo/schemas";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { AgentPanel } from "./AgentPanel";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";

const storyRuntimes: AgentRuntimeConfig[] = [
  {
    id: "runtime-codex",
    name: "Codex Local",
    type: "codex",
    connection: { mode: "local" },
  },
];

const overflowDiagnostics: PipelineActionDiagnostic[] = [
  {
    code: "DUPLICATE_NODE_ID",
    severity: "error",
    message:
      "Generated node id collides with an existing canvas node and must be renamed before applying the proposal.",
  },
  {
    code: "INVALID_CONNECTION",
    severity: "warning",
    message:
      "One proposed operation is missing an upstream object input and needs manual review before the graph can be saved.",
  },
  {
    code: "INVALID_CONNECTION",
    severity: "warning",
    message:
      "The generated reporting branch still needs a final connection to the output node before it can be applied safely.",
  },
  {
    code: "INVALID_NODE_DATA",
    severity: "warning",
    message:
      "Several generated operation labels should be renamed to match the existing workspace naming convention.",
  },
];

const overflowProposal: PipelineActionProposal = {
  summary:
    "Expand the pipeline with review, cleanup, reporting, and verification operations while keeping the existing output path intact.",
  actions: Array.from({ length: 28 }, (_, index) => ({
    type: "addNode",
    node: {
      id: `story-op-${index}`,
      type: "operation",
      position: { x: 240 + index * 64, y: 120 + (index % 3) * 80 },
      data: {
        nodeType: "operation",
        operationId: `story-operation-${index}`,
        operationName: `Story Operation ${index + 1}`,
        label: `Story Operation ${index + 1}`,
        status: "idle",
      },
    },
  })),
};

const AgentPanelStory = ({
  diagnostics = null,
  proposal = null,
}: {
  diagnostics?: PipelineActionDiagnostic[] | null;
  proposal?: PipelineActionProposal | null;
}) => {
  const storeRef = useRef<CanvasPageStore | null>(null);
  const originalGetOneRef = useRef(dataProvider.getOne);
  const originalGetListRef = useRef(dataProvider.getList);

  if (!storeRef.current) {
    storeRef.current = createCanvasPageStore([], [], "story-pipeline", "Story Pipeline");
    storeRef.current.setState({
      agentPanel: {
        isOpen: true,
        pendingProposal: proposal,
        diagnostics,
        isLoading: false,
      },
    });
  }

  useEffect(() => {
    const store = storeRef.current;
    if (!store) {
      return;
    }

    store.setState({
      agentPanel: {
        isOpen: true,
        pendingProposal: proposal,
        diagnostics,
        isLoading: false,
      },
    });

    dataProvider.getOne = async <TData extends BaseRecord = BaseRecord>(params: GetOneParams) => {
      if (params.resource === ResourceName.settings) {
        return {
          data: { id: "default", defaultAgentRuntime: "codex" } as unknown as TData,
        } satisfies GetOneResponse<TData>;
      }

      return originalGetOneRef.current!(params) as Promise<GetOneResponse<TData>>;
    };
    dataProvider.getList = async <TData extends BaseRecord = BaseRecord>(params: GetListParams) => {
      if (params.resource === ResourceName.agentRuntimes) {
        return {
          data: storyRuntimes as unknown as TData[],
          total: storyRuntimes.length,
        } satisfies GetListResponse<TData>;
      }

      return originalGetListRef.current!(params) as Promise<GetListResponse<TData>>;
    };

    return () => {
      dataProvider.getOne = originalGetOneRef.current;
      dataProvider.getList = originalGetListRef.current;
    };
  }, [diagnostics, proposal]);

  return (
    <CanvasPageStoreContext.Provider value={storeRef.current}>
      <div className="relative h-[540px] w-[420px] overflow-hidden rounded-md border bg-slate-50">
        <AgentPanel />
      </div>
    </CanvasPageStoreContext.Provider>
  );
};

const meta: Meta<typeof AgentPanelStory> = {
  title: "CanvasPage/AgentPanel",
  component: AgentPanelStory,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Right-side AI assistant panel for proposing canvas graph edits. Stories focus on overflow behavior for diagnostics and proposal review without a backend.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AgentPanelStory>;

export const Default: Story = {
  args: {},
};

export const OverflowContent: Story = {
  args: {
    diagnostics: overflowDiagnostics,
    proposal: overflowProposal,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Long diagnostics and many proposal actions force the middle content area to scroll while the input dock stays pinned to the bottom.",
      },
    },
  },
};
