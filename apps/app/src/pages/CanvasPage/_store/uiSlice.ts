import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";
import { DEFAULT_CANVAS_VIEWPORT } from "../utils/canvasViewport";

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
  viewportZoom: number;
  sidebarPanel: SidebarPanel;
  isSidebarOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isConsoleOpen: boolean;
  activeJobId: string | null;
  contextMenu: ContextMenuState | null;
  connectionMenu: ContextMenuState | null;
  nodeContextMenu: NodeContextMenuState | null;
  connectStart: ConnectStartState | null;
  shouldIgnorePaneClick: boolean;
  isQuickAddOpen: boolean;

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
  toggleConsole: () => void;
  setActiveJobId: (jobId: string | null) => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  openConnectionMenu: (state: ContextMenuState) => void;
  closeConnectionMenu: () => void;
  openNodeContextMenu: (state: NodeContextMenuState) => void;
  closeNodeContextMenu: () => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  toggleQuickAdd: () => void;
  handleConnectStart: (state: ConnectStartState | null) => void;
  setPipelineName: (name: string) => void;
  setViewportZoom: (zoom: number) => void;

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
  viewportZoom: DEFAULT_CANVAS_VIEWPORT.zoom,
  sidebarPanel: "components",
  isSidebarOpen: true,
  isPropertiesPanelOpen: false,
  isConsoleOpen: false,
  activeJobId: null,
  contextMenu: null,
  connectionMenu: null,
  nodeContextMenu: null,
  connectStart: null,
  shouldIgnorePaneClick: false,
  isQuickAddOpen: false,
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

  openQuickAdd: () => {
    set({
      isQuickAddOpen: true,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  closeQuickAdd: () => {
    set({ isQuickAddOpen: false });
  },

  toggleQuickAdd: () => {
    set((state) => ({
      isQuickAddOpen: !state.isQuickAddOpen,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    }));
  },

  handleConnectStart: (state) => {
    set({ connectStart: state });
  },

  setPipelineName: (name) => {
    set({ pipelineName: name });
  },

  setViewportZoom: (zoom) => {
    set({ viewportZoom: zoom });
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
      isQuickAddOpen: false,
    });
  },

  showPaneContextMenu: (state) => {
    set({
      connectStart: null,
      connectionMenu: null,
      contextMenu: state,
      isQuickAddOpen: false,
    });
  },

  showNodeContextMenu: (nodeId, screenX, screenY) => {
    set({
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: { screenX, screenY, nodeId },
      connectStart: null,
      isQuickAddOpen: false,
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
