import type { ChangeEvent } from "react";
import { applyPipelineActions } from "@repo/pipeline-engine/actions";
import type {
  Job,
  NodeRunStatus,
  PipelineActionDiagnostic,
  PipelineActionProposal,
} from "@repo/schemas";
import type { CanvasPageStoreSlice } from "./canvasPageStore";
import { DEFAULT_CANVAS_VIEWPORT } from "../utils/canvasViewport";
import {
  appendAgentActivity,
  type AgentActivityEntry,
} from "../../../components/AgentActivityFeed";

export type SidebarPanel = "components" | "properties" | null;

export type CanvasComponentCategory = "input" | "operations" | "skills" | "output";

export type NodeCardMode = "compact" | "expanded";

export type CanvasTool = "hand" | "select";

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

export interface CanvasSettingsState {
  showMiniMap: boolean;
  showControls: boolean;
  showBackground: boolean;
  snapToGrid: boolean;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettingsState = {
  showMiniMap: true,
  showControls: false,
  showBackground: true,
  snapToGrid: false,
};

export const DEFAULT_WORKSPACE_PANEL_WIDTH = 300;
export const MIN_WORKSPACE_PANEL_WIDTH = 288;
export const MAX_WORKSPACE_PANEL_WIDTH = 560;

export const DEFAULT_AGENT_PANEL_WIDTH = 344;
export const MIN_AGENT_PANEL_WIDTH = 300;
export const MAX_AGENT_PANEL_WIDTH = 520;

export const clampWorkspacePanelWidth = (width: number) =>
  Math.min(MAX_WORKSPACE_PANEL_WIDTH, Math.max(MIN_WORKSPACE_PANEL_WIDTH, width));

export const clampAgentPanelWidth = (width: number) =>
  Math.min(MAX_AGENT_PANEL_WIDTH, Math.max(MIN_AGENT_PANEL_WIDTH, width));

export interface AgentPanelState {
  isOpen: boolean;
  pendingProposal: PipelineActionProposal | null;
  diagnostics: PipelineActionDiagnostic[] | null;
  isLoading: boolean;
}

export interface UISlice {
  pipelineId: string | null;
  pipelineName: string;
  pipelineSharedContext: string;
  viewportZoom: number;
  canvasSettings: CanvasSettingsState;
  sidebarPanel: SidebarPanel;
  componentSearchQuery: string;
  collapsedComponentCategories: Record<CanvasComponentCategory, boolean>;
  isWorkspaceSidebarOpen: boolean;
  workspacePanelWidth: number;
  nodeCardMode: NodeCardMode;
  isSidebarOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isCanvasSettingsOpen: boolean;
  isConsoleOpen: boolean;
  activeJobId: string | null;
  contextMenu: ContextMenuState | null;
  connectionMenu: ContextMenuState | null;
  nodeContextMenu: NodeContextMenuState | null;
  connectStart: ConnectStartState | null;
  shouldIgnorePaneClick: boolean;
  isQuickAddOpen: boolean;
  quickAddQuery: string;
  isConsoleCollapsed: boolean;
  isCanvasInteractive: boolean;
  canvasTool: CanvasTool;

  // Pipeline test run state
  isTestRunning: boolean;
  isRunning: boolean;
  runningNodeId: string | null;
  nodeRunStatuses: Record<string, NodeRunStatus>;
  nodeLlmContent: Record<string, string>;
  nodeAgentActivities: Record<string, AgentActivityEntry[]>;
  inspectingNodeId: string | null;

  // Agent panel state
  agentPanel: AgentPanelState;
  agentPanelWidth: number;

  // Operation node UI state
  operationAgentDropdownNodeId: string | null;

  handlePipelineIdChange: (id: string) => void;
  handleSidebarPanelChange: (panel: SidebarPanel) => void;
  handleComponentSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  setComponentSearchQuery: (query: string) => void;
  toggleComponentCategory: (category: CanvasComponentCategory) => void;
  openWorkspaceSidebar: () => void;
  closeWorkspaceSidebar: () => void;
  setWorkspacePanelWidth: (width: number) => void;
  setNodeCardMode: (mode: NodeCardMode) => void;
  toggleNodeCardMode: () => void;
  handleToggleSidebar: () => void;
  openPropertiesPanel: () => void;
  closePropertiesPanel: () => void;
  openCanvasSettings: () => void;
  closeCanvasSettings: () => void;
  updateCanvasSettings: (settings: Partial<CanvasSettingsState>) => void;
  toggleConsole: () => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  openConnectionMenu: (state: ContextMenuState) => void;
  closeConnectionMenu: () => void;
  openNodeContextMenu: (state: NodeContextMenuState) => void;
  closeNodeContextMenu: () => void;
  handleOpenQuickAdd: () => void;
  handleCloseQuickAdd: () => void;
  handleToggleQuickAdd: () => void;
  handleQuickAddInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleToggleConsoleCollapse: () => void;
  handleToggleCanvasInteractive: () => void;
  setCanvasTool: (tool: CanvasTool) => void;
  handleQuickAddKeyDown: (event: React.KeyboardEvent) => void;
  handleConnectStart: (state: ConnectStartState | null) => void;
  handlePipelineNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handlePipelineSharedContextChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handleFlowMove: (zoom: number) => void;

  // Pipeline run actions
  startTestRun: () => void;
  stopTestRun: () => void;
  applyNodeLlmContent: (nodeId: string, content: string) => void;
  applyNodeAgentActivity: (nodeId: string, activity: AgentActivityEntry) => void;
  restoreRunState: (job: Job) => void;
  setNodeRunStatuses: (statuses: Record<string, NodeRunStatus>) => void;

  // Semantic actions
  handleCloseConsole: () => void;
  handleDismissInspection: () => void;
  dismissAllMenus: () => void;
  showPaneContextMenu: (state: ContextMenuState) => void;
  showNodeContextMenu: (nodeId: string, screenX: number, screenY: number) => void;
  markNodeRunning: (nodeId: string) => void;
  markNodePassed: (nodeId: string) => void;
  markNodeFailed: (nodeId: string) => void;

  // Agent panel actions
  setAgentPanelWidth: (width: number) => void;
  toggleAgentPanel: () => void;
  setPendingProposal: (
    proposal: PipelineActionProposal | null,
    diagnostics: PipelineActionDiagnostic[] | null,
  ) => void;
  clearPendingProposal: () => void;
  applyAgentProposal: (proposal: PipelineActionProposal) => boolean;
}

export const createUISlice = (
  set: Parameters<CanvasPageStoreSlice>[0],
  get: Parameters<CanvasPageStoreSlice>[1],

  pipelineId: string | null = null,
  pipelineName = "",
  pipelineSharedContext = "",
): UISlice => ({
  pipelineId,
  pipelineName,
  pipelineSharedContext,
  viewportZoom: DEFAULT_CANVAS_VIEWPORT.zoom,
  canvasSettings: { ...DEFAULT_CANVAS_SETTINGS },
  sidebarPanel: "components",
  componentSearchQuery: "",
  collapsedComponentCategories: {
    input: false,
    operations: false,
    skills: false,
    output: false,
  },
  isWorkspaceSidebarOpen: false,
  workspacePanelWidth: DEFAULT_WORKSPACE_PANEL_WIDTH,
  nodeCardMode: "compact",
  isSidebarOpen: true,
  isPropertiesPanelOpen: false,
  isCanvasSettingsOpen: false,
  isConsoleOpen: false,
  activeJobId: null,
  contextMenu: null,
  connectionMenu: null,
  nodeContextMenu: null,
  connectStart: null,
  shouldIgnorePaneClick: false,
  isQuickAddOpen: false,
  quickAddQuery: "",
  isConsoleCollapsed: false,
  isCanvasInteractive: true,
  canvasTool: "hand",
  // Pipeline test run state defaults
  isTestRunning: false,
  isRunning: false,
  runningNodeId: null,
  nodeRunStatuses: {},
  nodeLlmContent: {},
  nodeAgentActivities: {},
  inspectingNodeId: null,
  agentPanel: {
    isOpen: true,
    pendingProposal: null,
    diagnostics: null,
    isLoading: false,
  },
  agentPanelWidth: DEFAULT_AGENT_PANEL_WIDTH,
  operationAgentDropdownNodeId: null,
  handlePipelineIdChange: (id) => {
    set({ pipelineId: id });
  },

  handleSidebarPanelChange: (panel) => {
    set({ sidebarPanel: panel });
  },

  handleComponentSearchChange: (event) => {
    set({ componentSearchQuery: event.target.value });
  },

  setComponentSearchQuery: (query) => {
    set({ componentSearchQuery: query });
  },

  toggleComponentCategory: (category) => {
    set((state) => ({
      collapsedComponentCategories: {
        ...state.collapsedComponentCategories,
        [category]: !state.collapsedComponentCategories[category],
      },
    }));
  },

  openWorkspaceSidebar: () => {
    set({ isWorkspaceSidebarOpen: true });
  },

  closeWorkspaceSidebar: () => {
    set({ isWorkspaceSidebarOpen: false });
  },

  setWorkspacePanelWidth: (width) => {
    set({ workspacePanelWidth: clampWorkspacePanelWidth(width) });
  },

  setNodeCardMode: (mode) => {
    set({ nodeCardMode: mode });
  },

  toggleNodeCardMode: () => {
    set((state) => ({
      nodeCardMode: state.nodeCardMode === "compact" ? "expanded" : "compact",
    }));
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

  openCanvasSettings: () => {
    set({
      isCanvasSettingsOpen: true,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      isQuickAddOpen: false,
    });
  },

  closeCanvasSettings: () => {
    set({ isCanvasSettingsOpen: false });
  },

  updateCanvasSettings: (settings) => {
    set((state) => ({ canvasSettings: { ...state.canvasSettings, ...settings } }));
  },

  toggleConsole: () => {
    set((state) => ({ isConsoleOpen: !state.isConsoleOpen }));
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

  handleOpenQuickAdd: () => {
    set({
      isQuickAddOpen: true,
      quickAddQuery: "",
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  handleCloseQuickAdd: () => {
    set({ isQuickAddOpen: false, quickAddQuery: "" });
  },

  handleToggleQuickAdd: () => {
    set((state) => ({
      isQuickAddOpen: !state.isQuickAddOpen,
      quickAddQuery: "",
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    }));
  },

  handleQuickAddInputChange: (event) => {
    set({ quickAddQuery: event.target.value });
  },

  handleToggleConsoleCollapse: () => {
    set((state) => ({ isConsoleCollapsed: !state.isConsoleCollapsed }));
  },

  handleToggleCanvasInteractive: () => {
    set((state) => ({ isCanvasInteractive: !state.isCanvasInteractive }));
  },

  setCanvasTool: (canvasTool) => {
    set({ canvasTool });
  },

  handleQuickAddKeyDown: (event) => {
    if (event.key === "Escape") {
      set({ isQuickAddOpen: false, quickAddQuery: "" });
    }
  },

  handleConnectStart: (state) => {
    set({ connectStart: state });
  },

  handlePipelineNameChange: (event) => {
    set({ pipelineName: event.target.value });
  },

  handlePipelineSharedContextChange: (event) => {
    set({ pipelineSharedContext: event.target.value });
  },

  handleFlowMove: (zoom) => {
    const currentZoom = get().viewportZoom;
    if (Math.abs(currentZoom - zoom) > 0.001) {
      set({ viewportZoom: zoom });
    }
  },

  startTestRun: () => {
    set({
      isTestRunning: true,
      runningNodeId: null,
      nodeRunStatuses: {},
      nodeLlmContent: {},
      nodeAgentActivities: {},
      inspectingNodeId: null,
    });
  },

  stopTestRun: () => {
    set({ isTestRunning: false, runningNodeId: null });
  },

  applyNodeLlmContent: (nodeId, content) => {
    set((state) => ({
      nodeLlmContent: { ...state.nodeLlmContent, [nodeId]: content },
    }));
  },

  applyNodeAgentActivity: (nodeId, activity) => {
    set((state) => ({
      nodeAgentActivities: {
        ...state.nodeAgentActivities,
        [nodeId]: appendAgentActivity(state.nodeAgentActivities[nodeId] ?? [], activity),
      },
    }));
  },

  restoreRunState: (job) => {
    const live = job.status === "queued" || job.status === "running" || job.status === "paused";
    const nodeRunStatuses = { ...job.nodeStatuses };
    const runningNodeId =
      Object.entries(nodeRunStatuses).find(
        ([, status]) => status === "running" || status === "retrying",
      )?.[0] ?? null;

    set({
      activeJobId: live ? job.id : null,
      isConsoleOpen: live,
      isTestRunning: live,
      nodeRunStatuses,
      runningNodeId,
    });
  },

  setNodeRunStatuses: (nodeRunStatuses) => {
    const runningNodeId =
      Object.entries(nodeRunStatuses).find(
        ([, status]) => status === "running" || status === "retrying",
      )?.[0] ?? null;

    set({ nodeRunStatuses: { ...nodeRunStatuses }, runningNodeId });
  },

  // Semantic actions
  handleCloseConsole: () => {
    set({ isConsoleOpen: false });
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
        [nodeId]: "done" as NodeRunStatus,
      },
    }));
  },

  markNodeFailed: (nodeId) => {
    set((state) => ({
      runningNodeId: null,
      nodeRunStatuses: {
        ...state.nodeRunStatuses,
        [nodeId]: "failed" as NodeRunStatus,
      },
    }));
  },

  setAgentPanelWidth: (width) => {
    set({ agentPanelWidth: clampAgentPanelWidth(width) });
  },

  toggleAgentPanel: () => {
    set((state) => ({
      agentPanel: {
        ...state.agentPanel,
        isOpen: !state.agentPanel.isOpen,
        ...(state.agentPanel.isOpen ? { pendingProposal: null, diagnostics: null } : {}),
      },
    }));
  },

  setPendingProposal: (proposal, diagnostics) => {
    set((state) => ({
      agentPanel: {
        ...state.agentPanel,
        pendingProposal: proposal,
        diagnostics,
        isLoading: false,
      },
    }));
  },

  clearPendingProposal: () => {
    set((state) => ({
      agentPanel: {
        ...state.agentPanel,
        pendingProposal: null,
        diagnostics: null,
        isLoading: false,
      },
    }));
  },

  applyAgentProposal: (proposal) => {
    const { edges, nodes, recordCommand } = get();
    const result = applyPipelineActions({ nodes, edges }, proposal.actions);

    if (result.isErr()) {
      set((state) => ({
        agentPanel: {
          ...state.agentPanel,
          diagnostics: result.error,
          isLoading: false,
        },
      }));

      return false;
    }

    const next = result.value;
    recordCommand(
      {
        type: "APPLY_AGENT_PROPOSAL",
        label: `Apply AI proposal: ${proposal.summary}`,
        payload: {
          actionCount: proposal.actions.length,
          summary: proposal.summary,
        },
      },
      (draft) => {
        draft.nodes = next.nodes as typeof draft.nodes;
        draft.edges = next.edges as typeof draft.edges;
      },
    );

    set((state) => ({
      selectedNodeId: null,
      selectedEdgeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
      isQuickAddOpen: false,
      quickAddQuery: "",
      agentPanel: {
        ...state.agentPanel,
        pendingProposal: null,
        diagnostics: null,
        isLoading: false,
      },
    }));

    return true;
  },
});
