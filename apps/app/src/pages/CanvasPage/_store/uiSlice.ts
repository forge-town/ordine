import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";

export interface NodeRunState {
  runStatus: NodeRunStatus | undefined;
  dimmed: boolean;
}

export type SidebarPanel = "components" | "properties" | "ai-assistant" | null;

export interface ContextMenuState {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
}

export interface NodeContextMenuState {
  screenX: number;
  screenY: number;
  nodeId: string;
}

export interface ConnectStartState {
  nodeId: string;
  handleId: string | null;
  handleType: "source" | "target" | null;
}

export interface UISlice {
  pipelineId: string | null;
  pipelineName: string;
  sidebarPanel: SidebarPanel;
  isSidebarOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isAiAssistantOpen: boolean;
  isConsoleOpen: boolean;
  activeJobId: string | null;
  contextMenu: ContextMenuState | null;
  connectionMenu: ContextMenuState | null;
  nodeContextMenu: NodeContextMenuState | null;
  connectStart: ConnectStartState | null;
  shouldIgnorePaneClick: boolean;

  // Pipeline test run state
  isTestRunning: boolean;
  isRunning: boolean;
  runningNodeId: string | null;
  nodeRunStatuses: Record<string, NodeRunStatus>;
  nodeLlmContent: Record<string, string>;
  inspectingNodeId: string | null;

  handlePipelineIdChange: (id: string) => void;
  handleSidebarPanelChange: (panel: SidebarPanel) => void;
  handleToggleSidebar: () => void;
  openPropertiesPanel: () => void;
  closePropertiesPanel: () => void;
  handleToggleAi: () => void;
  toggleConsole: () => void;
  setActiveJobId: (jobId: string | null) => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  openConnectionMenu: (state: ContextMenuState) => void;
  closeConnectionMenu: () => void;
  openNodeContextMenu: (state: NodeContextMenuState) => void;
  closeNodeContextMenu: () => void;
  handleConnectStart: (state: ConnectStartState | null) => void;
  setPipelineName: (name: string) => void;

  // Pipeline run actions
  startTestRun: () => void;
  stopTestRun: () => void;
  setNodeRunStatus: (nodeId: string, status: NodeRunStatus) => void;
  setRunningNodeId: (nodeId: string | null) => void;
  setNodeLlmContent: (nodeId: string, content: string) => void;
  setInspectingNodeId: (nodeId: string | null) => void;

  // Semantic actions
  handleCloseConsole: () => void;
  handleDismissInspection: () => void;
  dismissAllMenus: () => void;
  showPaneContextMenu: (state: ContextMenuState) => void;
  showNodeContextMenu: (nodeId: string, screenX: number, screenY: number) => void;
  markNodeRunning: (nodeId: string) => void;
  markNodePassed: (nodeId: string) => void;
  markNodeFailed: (nodeId: string) => void;
}

export const createUISlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],

  pipelineId: string | null = null,
  pipelineName = ""
): UISlice => ({
  pipelineId,
  pipelineName,
  sidebarPanel: "components",
  isSidebarOpen: true,
  isPropertiesPanelOpen: false,
  isAiAssistantOpen: false,
  isConsoleOpen: false,
  activeJobId: null,
  contextMenu: null,
  connectionMenu: null,
  nodeContextMenu: null,
  connectStart: null,
  shouldIgnorePaneClick: false,
  // Pipeline test run state defaults
  isTestRunning: false,
  isRunning: false,
  runningNodeId: null,
  nodeRunStatuses: {},
  nodeLlmContent: {},
  inspectingNodeId: null,
  handlePipelineIdChange: (id) => {
    set({ pipelineId: id });
  },

  handleSidebarPanelChange: (panel) => {
    set({ sidebarPanel: panel });
  },

  handleToggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  openPropertiesPanel: () => {
    set({ isPropertiesPanelOpen: true });
  },

  closePropertiesPanel: () => {
    set({ isPropertiesPanelOpen: false });
  },

  handleToggleAi: () => {
    set((state) => ({ isAiAssistantOpen: !state.isAiAssistantOpen }));
  },

  toggleConsole: () => {
    set((state) => ({ isConsoleOpen: !state.isConsoleOpen }));
  },

  setActiveJobId: (jobId) => {
    set({ activeJobId: jobId, isConsoleOpen: jobId !== null });
  },

  openContextMenu: (state) => {
    set({ contextMenu: state });
  },

  closeContextMenu: () => {
    set({ contextMenu: null });
  },

  openConnectionMenu: (state) => {
    set({ connectionMenu: state });
  },

  closeConnectionMenu: () => {
    set({ connectionMenu: null });
  },

  openNodeContextMenu: (state) => {
    set({ nodeContextMenu: state });
  },

  closeNodeContextMenu: () => {
    set({ nodeContextMenu: null });
  },

  handleConnectStart: (state) => {
    set({ connectStart: state });
  },

  setPipelineName: (name) => {
    set({ pipelineName: name });
  },

  startTestRun: () => {
    set({
      isTestRunning: true,
      runningNodeId: null,
      nodeRunStatuses: {},
      nodeLlmContent: {},
      inspectingNodeId: null,
    });
  },

  stopTestRun: () => {
    set({ isTestRunning: false, runningNodeId: null });
  },

  setNodeRunStatus: (nodeId, status) => {
    set((state) => ({
      nodeRunStatuses: { ...state.nodeRunStatuses, [nodeId]: status },
    }));
  },

  setRunningNodeId: (nodeId) => {
    set({ runningNodeId: nodeId });
  },

  setNodeLlmContent: (nodeId, content) => {
    set((state) => ({
      nodeLlmContent: { ...state.nodeLlmContent, [nodeId]: content },
    }));
  },

  setInspectingNodeId: (nodeId) => {
    set({ inspectingNodeId: nodeId });
  },

  // Semantic actions
  handleCloseConsole: () => {
    set({ activeJobId: null, isConsoleOpen: false });
  },

  handleDismissInspection: () => {
    set({ inspectingNodeId: null });
  },

  dismissAllMenus: () => {
    set({
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  showPaneContextMenu: (state) => {
    set({
      connectStart: null,
      connectionMenu: null,
      contextMenu: state,
    });
  },

  showNodeContextMenu: (nodeId, screenX, screenY) => {
    set({
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: { screenX, screenY, nodeId },
      connectStart: null,
    });
  },

  markNodeRunning: (nodeId) => {
    set((state) => ({
      runningNodeId: nodeId,
      nodeRunStatuses: {
        ...state.nodeRunStatuses,
        [nodeId]: "running" as NodeRunStatus,
      },
    }));
  },

  markNodePassed: (nodeId) => {
    set((state) => ({
      runningNodeId: null,
      nodeRunStatuses: {
        ...state.nodeRunStatuses,
        [nodeId]: "pass" as NodeRunStatus,
      },
    }));
  },

  markNodeFailed: (nodeId) => {
    set((state) => ({
      runningNodeId: null,
      nodeRunStatuses: {
        ...state.nodeRunStatuses,
        [nodeId]: "fail" as NodeRunStatus,
      },
    }));
  },
});

export const selectNodeRunState =
  (nodeId: string) =>
  (state: UISlice): NodeRunState => {
    const runStatus = state.nodeRunStatuses[nodeId];
    const dimmed =
      state.isTestRunning &&
      state.runningNodeId !== null &&
      state.runningNodeId !== nodeId &&
      runStatus !== "running";

    return { runStatus, dimmed };
  };
