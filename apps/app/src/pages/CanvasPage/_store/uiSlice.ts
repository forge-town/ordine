import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";

export type SidebarPanel = "components" | "properties" | "ai-assistant" | null;

export interface ContextMenuState {
  screenX: number;
  screenY: number;
  flowX: number;
  flowY: number;
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
  contextMenu: ContextMenuState | null;
  connectStart: ConnectStartState | null;

  setSidebarPanel: (panel: SidebarPanel) => void;
  toggleSidebar: () => void;
  openPropertiesPanel: () => void;
  closePropertiesPanel: () => void;
  toggleAiAssistant: () => void;
  openContextMenu: (state: ContextMenuState) => void;
  closeContextMenu: () => void;
  setConnectStart: (state: ConnectStartState | null) => void;
}

export const createUISlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  pipelineId: string | null = null,
  pipelineName = "",
): UISlice => ({
  pipelineId,
  pipelineName,
  sidebarPanel: "components",
  isSidebarOpen: true,
  isPropertiesPanelOpen: false,
  isAiAssistantOpen: false,
  contextMenu: null,
  connectStart: null,

  setSidebarPanel: (panel) => {
    set({ sidebarPanel: panel });
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  openPropertiesPanel: () => {
    set({ isPropertiesPanelOpen: true });
  },

  closePropertiesPanel: () => {
    set({ isPropertiesPanelOpen: false });
  },

  toggleAiAssistant: () => {
    set((state) => ({ isAiAssistantOpen: !state.isAiAssistantOpen }));
  },

  openContextMenu: (state) => {
    set({ contextMenu: state });
  },

  closeContextMenu: () => {
    set({ contextMenu: null });
  },

  setConnectStart: (state) => {
    set({ connectStart: state });
  },
});
