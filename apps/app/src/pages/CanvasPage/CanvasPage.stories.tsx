import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import type { PipelineActionProposal } from "@repo/schemas";
import { CanvasPageContent } from "./CanvasPageContent";
import {
  CanvasPageStoreContext,
  createCanvasPageStore,
  type CanvasPageStore,
  type NodeCardMode,
  type PipelineEdge,
  type PipelineNode,
} from "./_store";
import { canvasStoryDataProvider } from "./storybookData";

const sourceNode = {
  id: "source-file",
  type: "file",
  position: { x: 80, y: 120 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "Pipeline source",
  },
} as PipelineNode;

const operationNode = {
  id: "review-op",
  type: "operation",
  position: { x: 420, y: 120 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "idle",
    config: {},
  },
} as PipelineNode;

const connectedEdge = {
  id: "source-to-review",
  source: "source-file",
  target: "review-op",
  type: "default",
  animated: true,
  data: {},
} as PipelineEdge;

const crowdedSourceNode = {
  ...sourceNode,
  id: "crowded-source",
  position: { x: 120, y: 160 },
  data: {
    ...sourceNode.data,
    label: "Crowded Source",
  },
} as PipelineNode;

const crowdedReviewNode = {
  ...operationNode,
  id: "crowded-review",
  position: { x: 120, y: 160 },
  data: {
    ...operationNode.data,
    label: "Review Branch",
  },
} as PipelineNode;

const crowdedSummarizeNode = {
  ...operationNode,
  id: "crowded-summarize",
  position: { x: 120, y: 160 },
  data: {
    ...operationNode.data,
    label: "Summarize Branch",
  },
} as PipelineNode;

const crowdedOutputNode = {
  id: "crowded-output",
  type: "output-local-path",
  position: { x: 120, y: 160 },
  data: {
    label: "Write Output",
    nodeType: "output-local-path",
    localPath: "out",
    outputFileName: "report.md",
    outputMode: "overwrite",
  },
} as PipelineNode;

const crowdedEdges = [
  {
    id: "crowded-source-review",
    source: "crowded-source",
    target: "crowded-review",
    type: "default",
    animated: true,
    data: {},
  },
  {
    id: "crowded-source-summarize",
    source: "crowded-source",
    target: "crowded-summarize",
    type: "default",
    animated: true,
    data: {},
  },
  {
    id: "crowded-review-output",
    source: "crowded-review",
    target: "crowded-output",
    type: "default",
    animated: true,
    data: {},
  },
  {
    id: "crowded-summarize-output",
    source: "crowded-summarize",
    target: "crowded-output",
    type: "default",
    animated: true,
    data: {},
  },
] as PipelineEdge[];

const aiSourceNode = {
  ...sourceNode,
  id: "ai-source",
  position: { x: 120, y: 160 },
  data: {
    ...sourceNode.data,
    label: "AI Source File",
  },
} as PipelineNode;

const aiReviewNode = {
  ...operationNode,
  id: "ai-review",
  position: { x: 120, y: 160 },
  data: {
    ...operationNode.data,
    label: "AI Review",
  },
} as PipelineNode;

const aiSummarizeNode = {
  ...operationNode,
  id: "ai-summarize",
  position: { x: 120, y: 160 },
  data: {
    ...operationNode.data,
    label: "AI Summarize",
  },
} as PipelineNode;

const aiOutputNode = {
  ...crowdedOutputNode,
  id: "ai-output",
  position: { x: 120, y: 160 },
  data: {
    ...crowdedOutputNode.data,
    label: "AI Output",
  },
} as PipelineNode;

const aiAutoLayoutProposal: PipelineActionProposal = {
  summary: "Add review, summarization, and output steps from the agent.",
  actions: [
    { type: "addNode", node: aiReviewNode },
    { type: "addNode", node: aiSummarizeNode },
    { type: "addNode", node: aiOutputNode },
    {
      type: "addEdge",
      edge: {
        id: "ai-source-review",
        source: "ai-source",
        target: "ai-review",
        type: "default",
        animated: true,
        data: {},
      } as PipelineEdge,
    },
    {
      type: "addEdge",
      edge: {
        id: "ai-source-summarize",
        source: "ai-source",
        target: "ai-summarize",
        type: "default",
        animated: true,
        data: {},
      } as PipelineEdge,
    },
    {
      type: "addEdge",
      edge: {
        id: "ai-review-output",
        source: "ai-review",
        target: "ai-output",
        type: "default",
        animated: true,
        data: {},
      } as PipelineEdge,
    },
    {
      type: "addEdge",
      edge: {
        id: "ai-summarize-output",
        source: "ai-summarize",
        target: "ai-output",
        type: "default",
        animated: true,
        data: {},
      } as PipelineEdge,
    },
  ],
};

const makeStressOperationNode = (id: string, label: string, description: string): PipelineNode =>
  ({
    id,
    type: "operation",
    position: { x: 120, y: 160 },
    measured: { width: 360, height: 180 },
    data: {
      label,
      nodeType: "operation",
      operationId: id,
      operationName: label,
      status: "idle",
      config: {},
      description,
    },
  }) as PipelineNode;

const stressSourceNode = {
  ...sourceNode,
  id: "stress-source",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    ...sourceNode.data,
    label: "Expanded Source",
    description:
      "Large source card used to verify ELK spacing when generated nodes are displayed in expanded mode.",
  },
} as PipelineNode;

const stressFolderNode = {
  id: "stress-folder",
  type: "folder",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    label: "App Source Folder",
    nodeType: "folder",
    folderPath: "apps/app/src",
    description: "Full front-end folder context for the generated workflow.",
  },
} as PipelineNode;

const stressProjectNode = {
  id: "stress-project",
  type: "github-project",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    label: "Ordine Repository",
    nodeType: "github-project",
    owner: "forge-town",
    repo: "ordine",
    branch: "develop",
    description: "Repository-level context used by architecture and review steps.",
  },
} as PipelineNode;

const stressPromptNode = {
  id: "stress-prompt",
  type: "prompt",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    label: "Reviewer Intent",
    nodeType: "prompt",
    prompt:
      "Validate layout readability with many generated nodes, compact cards, expanded cards, and card selection.",
  },
} as PipelineNode;

const stressOperationSpecs = [
  {
    id: "stress-extract",
    label: "Extract Requirements",
    description:
      "Read project files and identify concrete implementation constraints before changing code.",
  },
  {
    id: "stress-inventory",
    label: "Inventory Canvas",
    description: "List current nodes, edges, card modes, and browser-visible layout constraints.",
  },
  {
    id: "stress-map",
    label: "Map Architecture",
    description: "Connect the canvas store, node renderers, proposal flow, and toolbar behavior.",
  },
  {
    id: "stress-requirements",
    label: "Normalize Requirements",
    description: "Turn user feedback into precise acceptance criteria and verifiable scenarios.",
  },
  {
    id: "stress-plan",
    label: "Plan Fix",
    description:
      "Choose the smallest implementation path that keeps the stacked PR easy to review.",
  },
  {
    id: "stress-risk",
    label: "Assess Risk",
    description:
      "Inspect layout, execution order, and user-facing feedback for hidden failure states.",
  },
  {
    id: "stress-tests",
    label: "Generate Tests",
    description:
      "Create focused tests for behavior, regression coverage, and browser-visible canvas changes.",
  },
  {
    id: "stress-fixtures",
    label: "Build Fixtures",
    description: "Create stable Storybook data for compact and expanded card pressure testing.",
  },
  {
    id: "stress-contract",
    label: "Check Contracts",
    description:
      "Verify generated node data still matches the canvas and operation editor contracts.",
  },
  {
    id: "stress-ui",
    label: "Implement UI",
    description:
      "Apply canvas-facing fixes without changing unrelated backend or pipeline schemas.",
  },
  {
    id: "stress-store",
    label: "Update Store",
    description:
      "Keep proposal application, node selection, and auto-layout state transitions coherent.",
  },
  {
    id: "stress-engine",
    label: "Tune Layout",
    description: "Tune ELK spacing so many nodes remain readable in both card density modes.",
  },
  {
    id: "stress-agent",
    label: "Wire Agent Flow",
    description:
      "Ensure every accepted agent proposal triggers a layout pass after graph mutation.",
  },
  {
    id: "stress-docs",
    label: "Summarize Evidence",
    description:
      "Collect verification commands, browser observations, screenshots, and reviewer-facing notes.",
  },
  {
    id: "stress-review",
    label: "Review Code",
    description:
      "Check the implementation against component, store, Storybook, and testing guidelines.",
  },
  {
    id: "stress-lint",
    label: "Run Lint",
    description: "Run fast static checks and keep the branch free from avoidable style drift.",
  },
  {
    id: "stress-browser",
    label: "Browser QA",
    description:
      "Use Chrome DevTools to verify proposal application, node spacing, and selection behavior.",
  },
  {
    id: "stress-expanded",
    label: "Expanded Card QA",
    description: "Open expanded cards after layout and check large descriptions do not collide.",
  },
  {
    id: "stress-compact",
    label: "Compact Card QA",
    description: "Switch compact mode pressure testing through the same generated graph structure.",
  },
  {
    id: "stress-package",
    label: "Package PR",
    description:
      "Prepare the final branch update, PR text, and stack-order instructions for reviewers.",
  },
  {
    id: "stress-handoff",
    label: "Prepare Handoff",
    description:
      "Leave enough context for reviewers to reproduce the same pressure validation quickly.",
  },
] as const;

const stressOperationNodes = stressOperationSpecs.map(({ id, label, description }) =>
  makeStressOperationNode(id, label, description),
) as PipelineNode[];

const stressOutputNode = {
  ...crowdedOutputNode,
  id: "stress-output",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    ...crowdedOutputNode.data,
    label: "Evidence Output",
    description: "Write verification artifacts and PR notes to the selected local output path.",
  },
} as PipelineNode;

const stressReportNode = {
  ...crowdedOutputNode,
  id: "stress-report",
  position: { x: 120, y: 160 },
  measured: { width: 360, height: 160 },
  data: {
    ...crowdedOutputNode.data,
    label: "Reviewer Report",
    outputFileName: "issue-96-stress-report.md",
    description: "Write a reviewer-facing stress report for compact and expanded card modes.",
  },
} as PipelineNode;

const stressNodes = [
  stressFolderNode,
  stressProjectNode,
  stressPromptNode,
  ...stressOperationNodes,
  stressOutputNode,
  stressReportNode,
] as PipelineNode[];

const makeStressEdge = (source: string, target: string): PipelineEdge =>
  ({
    id: `${source}-${target}`,
    source,
    target,
    type: "default",
    animated: true,
    data: {},
  }) as PipelineEdge;

const stressEdges = [
  makeStressEdge("stress-source", "stress-extract"),
  makeStressEdge("stress-source", "stress-inventory"),
  makeStressEdge("stress-folder", "stress-inventory"),
  makeStressEdge("stress-folder", "stress-map"),
  makeStressEdge("stress-project", "stress-map"),
  makeStressEdge("stress-project", "stress-requirements"),
  makeStressEdge("stress-prompt", "stress-requirements"),
  makeStressEdge("stress-extract", "stress-plan"),
  makeStressEdge("stress-inventory", "stress-plan"),
  makeStressEdge("stress-map", "stress-plan"),
  makeStressEdge("stress-requirements", "stress-risk"),
  makeStressEdge("stress-map", "stress-risk"),
  makeStressEdge("stress-plan", "stress-tests"),
  makeStressEdge("stress-risk", "stress-tests"),
  makeStressEdge("stress-plan", "stress-fixtures"),
  makeStressEdge("stress-inventory", "stress-fixtures"),
  makeStressEdge("stress-requirements", "stress-contract"),
  makeStressEdge("stress-project", "stress-contract"),
  makeStressEdge("stress-tests", "stress-ui"),
  makeStressEdge("stress-fixtures", "stress-ui"),
  makeStressEdge("stress-contract", "stress-ui"),
  makeStressEdge("stress-plan", "stress-store"),
  makeStressEdge("stress-contract", "stress-store"),
  makeStressEdge("stress-risk", "stress-engine"),
  makeStressEdge("stress-fixtures", "stress-engine"),
  makeStressEdge("stress-ui", "stress-agent"),
  makeStressEdge("stress-store", "stress-agent"),
  makeStressEdge("stress-engine", "stress-agent"),
  makeStressEdge("stress-ui", "stress-docs"),
  makeStressEdge("stress-agent", "stress-docs"),
  makeStressEdge("stress-docs", "stress-review"),
  makeStressEdge("stress-ui", "stress-review"),
  makeStressEdge("stress-store", "stress-lint"),
  makeStressEdge("stress-agent", "stress-lint"),
  makeStressEdge("stress-lint", "stress-browser"),
  makeStressEdge("stress-review", "stress-browser"),
  makeStressEdge("stress-browser", "stress-expanded"),
  makeStressEdge("stress-browser", "stress-compact"),
  makeStressEdge("stress-expanded", "stress-package"),
  makeStressEdge("stress-compact", "stress-package"),
  makeStressEdge("stress-docs", "stress-package"),
  makeStressEdge("stress-package", "stress-output"),
  makeStressEdge("stress-package", "stress-report"),
  makeStressEdge("stress-handoff", "stress-report"),
  makeStressEdge("stress-review", "stress-handoff"),
  makeStressEdge("stress-browser", "stress-handoff"),
] as PipelineEdge[];

const stressAutoLayoutProposal: PipelineActionProposal = {
  summary: "Generate an expanded multi-step workflow from the agent.",
  actions: [
    ...stressNodes.map((node) => ({ type: "addNode" as const, node })),
    ...stressEdges.map((edge) => ({ type: "addEdge" as const, edge })),
  ],
};

interface CanvasStoryProps {
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  isQuickAddOpen?: boolean;
  isConsoleOpen?: boolean;
  isTestRunning?: boolean;
  nodeCardMode?: NodeCardMode;
  selectedNodeId?: string | null;
  pendingProposal?: PipelineActionProposal | null;
}

const CanvasStory = ({
  nodes = [],
  edges = [],
  isQuickAddOpen = false,
  isConsoleOpen = false,
  isTestRunning = false,
  nodeCardMode = "compact",
  selectedNodeId = null,
  pendingProposal = null,
}: CanvasStoryProps) => {
  const storeRef = useRef<CanvasPageStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createCanvasPageStore(nodes, edges, "story-pipeline", "Story Pipeline");
    storeRef.current.setState({
      isQuickAddOpen,
      isConsoleOpen,
      isTestRunning,
      nodeCardMode,
      selectedNodeId,
      activeJobId: isConsoleOpen ? "job-story" : null,
      runningNodeId: isTestRunning ? "review-op" : null,
      nodeRunStatuses: isTestRunning ? { "review-op": "running" } : {},
      sidebarPanel: pendingProposal ? "ai-assistant" : "components",
      agentPanel: {
        isOpen: pendingProposal !== null,
        pendingProposal,
        diagnostics: null,
        isLoading: false,
      },
    });
  }

  return (
    <Refine dataProvider={canvasStoryDataProvider}>
      <CanvasPageStoreContext.Provider value={storeRef.current}>
        <div style={{ width: "100vw", height: "100vh" }}>
          <CanvasPageContent />
        </div>
      </CanvasPageStoreContext.Provider>
    </Refine>
  );
};

const meta: Meta<typeof CanvasStory> = {
  title: "Pages/CanvasPage",
  component: CanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full Canvas workbench scenarios covering the empty state, toolbar quick-add, connected nodes, run console, and MiniMap visibility. Mock Refine data keeps Operation lists available in Storybook.",
      },
    },
  },
};
export default meta;

type Story = StoryObj<typeof CanvasStory>;

export const EmptyCanvas: Story = {
  args: {
    nodes: [],
    edges: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "First-run canvas with the empty-state card and 125% default zoom in the status bar.",
      },
    },
  },
};

export const QuickAddOpen: Story = {
  args: {
    nodes: [],
    edges: [],
    isQuickAddOpen: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Empty canvas with the toolbar quick-add dialog open and populated from mock data.",
      },
    },
  },
};

export const ConnectedNodes: Story = {
  args: {
    nodes: [sourceNode, operationNode],
    edges: [connectedEdge],
    selectedNodeId: "source-file",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Two connected nodes with the source selected, useful for checking status bar and graph readability.",
      },
    },
  },
};

export const RunningWithConsole: Story = {
  args: {
    nodes: [sourceNode, operationNode],
    edges: [connectedEdge],
    isConsoleOpen: true,
    isTestRunning: true,
    selectedNodeId: "review-op",
  },
  parameters: {
    docs: {
      description: {
        story: "Run-state scenario with the console open and the active operation marked running.",
      },
    },
  },
};

export const MiniMapVisible: Story = {
  args: {
    nodes: [sourceNode, operationNode],
    edges: [connectedEdge],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple-node canvas where the MiniMap should be visible while the console is closed.",
      },
    },
  },
};

export const MiniMapHidden: Story = {
  args: {
    nodes: [sourceNode],
    edges: [],
  },
  parameters: {
    docs: {
      description: {
        story: "Single-node canvas where the MiniMap should remain hidden.",
      },
    },
  },
};

export const AutoLayoutCrowded: Story = {
  args: {
    nodes: [crowdedSourceNode, crowdedReviewNode, crowdedSummarizeNode, crowdedOutputNode],
    edges: crowdedEdges,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Crowded graph used to verify the toolbar auto-layout action spreads AI-generated or imported nodes into readable ELK layers.",
      },
    },
  },
};

export const AgentProposalAutoLayout: Story = {
  args: {
    nodes: [aiSourceNode],
    edges: [],
    pendingProposal: aiAutoLayoutProposal,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Agent proposal fixture where generated nodes start with overlapping positions and are automatically ELK-laid out after applying.",
      },
    },
  },
};

export const AgentProposalCompactStressLayout: Story = {
  args: {
    nodes: [stressSourceNode],
    edges: [],
    nodeCardMode: "compact",
    pendingProposal: stressAutoLayoutProposal,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Compact-card stress fixture where the agent adds 26 crowded nodes with dense multi-input edges and ELK must keep the graph readable.",
      },
    },
  },
};

export const AgentProposalExpandedStressLayout: Story = {
  args: {
    nodes: [stressSourceNode],
    edges: [],
    nodeCardMode: "expanded",
    pendingProposal: stressAutoLayoutProposal,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Expanded-card stress fixture where the agent adds 26 crowded nodes with dense multi-input edges and ELK must keep large cards from colliding.",
      },
    },
  },
};
