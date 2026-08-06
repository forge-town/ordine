import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineActionDiagnostic, PipelineActionProposal } from "@repo/schemas";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { AgentPanel } from "./AgentPanel";
import {
  Assistant,
  Bubble,
  CheckpointCard,
  ClarifyOptions,
  CompletionCard,
  DistillCard,
  ErrorActions,
  ErrorCard,
  MessageActions,
  MessageTurn,
  ProgressList,
  ProposalCard,
  RunStatusCard,
  SelfHealCard,
  SuggestionList,
  UserActionCard,
} from "./messages";
import type { AgentBarMessage } from "./_store";
import type { MessageTurnSubmitInput } from "./messages/MessageTurn";
import { setCanvasDataProvider } from "../../../lib/canvasDataProvider";
import { canvasStoryDataProvider } from "../storybookData";
import { AgentBarStoreProvider } from "./_store";

setCanvasDataProvider(canvasStoryDataProvider);

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
  }, [diagnostics, proposal]);

  return (
    <CanvasPageStoreContext.Provider value={storeRef.current}>
      <AgentBarStoreProvider pipelineId="story-pipeline">
        <div className="relative h-[540px] w-[420px] overflow-hidden rounded-md border bg-slate-50">
          <AgentPanel />
        </div>
      </AgentBarStoreProvider>
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
          "Canvas conversation baseline reusing Alan's Agent Bar styling: a bg-surface panel with a compact status header, plain assistant text, and foreground user bubbles. Stories also cover diagnostics and proposal review without a backend.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AgentPanelStory>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          "Baseline conversation flow with Alan-style assistant text, user bubbles, runtime selection, context upload, and the pinned request input.",
      },
    },
  },
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

const galleryMessage: AgentBarMessage = {
  content: "Add a review step after the existing transform.",
  id: "gallery-user",
  role: "user",
};

const CardsGallery = () => (
  <div className="flex w-[360px] max-w-full flex-col gap-3 overflow-hidden border bg-surface p-3 text-sm">
    <Assistant>Here is a compact review of the proposed pipeline change.</Assistant>
    <Bubble>Keep the current output path unchanged.</Bubble>
    <MessageActions alwaysVisible content="Copy this assistant message" />
    <MessageTurn
      isLast
      isSending={false}
      message={galleryMessage}
      runtimeId="story-runtime"
      visibleMessages={[galleryMessage]}
      onEditDraft={() => undefined}
      onOpenSettings={() => undefined}
      onSubmit={(_: MessageTurnSubmitInput) => undefined}
    />
    <ClarifyOptions
      options={["Use the existing review operation", "Create a new review operation"]}
      onSelect={() => undefined}
    />
    <ProgressList
      items={[
        { detail: "Review", done: true, id: "progress-1", title: "Inspect pipeline" },
        { detail: "Draft", id: "progress-2", title: "Prepare change" },
      ]}
      showStatus
    />
    <ProposalCard
      items={[
        { detail: "Review step", title: "Add node" },
        { detail: "review -> output", title: "Add edge" },
      ]}
      onApply={() => undefined}
      onReject={() => undefined}
      onRevise={() => undefined}
      subtitle="2 operations"
      title="Add a review branch"
    />
    <RunStatusCard isLive subtitle="Step 2 of 4 - Review" title="Running - job_story" />
    <CheckpointCard
      isWaiting
      nodeLabel="Review"
      onPause={() => undefined}
      onResume={() => undefined}
      onReview={() => undefined}
    />
    <SelfHealCard
      open
      steps={[{ label: "Retry succeeded", tone: "success" }]}
      subtitle="1 retry"
      title="Self-heal"
    />
    <UserActionCard
      requests={[{ kind: "credential", message: "Add the service credential.", nodeId: "review" }]}
      nodeLabelById={{ review: "Review" }}
      onAskAgent={() => undefined}
      onOpenConfig={() => undefined}
    />
    <ErrorCard
      title="Run failed"
      tryLabel="Open the failed node"
      what="The review step failed."
      why="The runtime returned an invalid response."
      onAction={() => undefined}
    />
    <ErrorActions code="AGENT_FAILED" onOpenSettings={() => undefined} onRetry={() => undefined} />
    <CompletionCard subtitle="41.3s" title="Completed">
      The pipeline is ready.
    </CompletionCard>
    <DistillCard onOpen={() => undefined} subtitle="Open in Components" title="Saved as a skill" />
    <SuggestionList items={[{ id: "suggestion-1", label: "Add a validation step" }]} />
  </div>
);

export const AllCards: Story = {
  render: () => <CardsGallery />,
  parameters: {
    docs: {
      description: {
        story: "Stable 360px gallery containing every AgentPanel message card.",
      },
    },
  },
};
