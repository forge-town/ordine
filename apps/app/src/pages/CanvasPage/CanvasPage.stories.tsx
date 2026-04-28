import { useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import type { PipelineEdge, PipelineNode } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";
import {
  HarnessCanvasStoreContext,
  createHarnessCanvasStore,
  type HarnessCanvasStore,
} from "./_store";
import { canvasStoryDataProvider } from "./storybookData";

const sourceNode = {
  id: "source-file",
  type: "code-file",
  position: { x: 80, y: 120 },
  data: {
    label: "Source File",
    nodeType: "code-file",
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

interface CanvasStoryProps {
  nodes?: PipelineNode[];
  edges?: PipelineEdge[];
  isQuickAddOpen?: boolean;
  isConsoleOpen?: boolean;
  isTestRunning?: boolean;
  selectedNodeId?: string | null;
}

const CanvasStory = ({
  nodes = [],
  edges = [],
  isQuickAddOpen = false,
  isConsoleOpen = false,
  isTestRunning = false,
  selectedNodeId = null,
}: CanvasStoryProps) => {
  const storeRef = useRef<HarnessCanvasStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHarnessCanvasStore(nodes, edges, "story-pipeline", "Story Pipeline");
    storeRef.current.setState({
      isQuickAddOpen,
      isConsoleOpen,
      isTestRunning,
      selectedNodeId,
      activeJobId: isConsoleOpen ? "job-story" : null,
      runningNodeId: isTestRunning ? "review-op" : null,
      nodeRunStatuses: isTestRunning ? { "review-op": "running" } : {},
    });
  }

  return (
    <Refine dataProvider={canvasStoryDataProvider}>
      <HarnessCanvasStoreContext.Provider value={storeRef.current}>
        <div style={{ width: "100vw", height: "100vh" }}>
          <CanvasPageContent />
        </div>
      </HarnessCanvasStoreContext.Provider>
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
          "Full Canvas workbench scenarios covering the empty state, toolbar quick-add, connected nodes, run console, and MiniMap visibility. Mock Refine data keeps Operation and Recipe lists available in Storybook.",
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
