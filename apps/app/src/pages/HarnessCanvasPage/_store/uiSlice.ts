import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";

export type SidebarPanel = "components" | "properties" | "ai-assistant" | null;

export interface UISlice {
  sidebarPanel: SidebarPanel;
  isSidebarOpen: boolean;
  isPropertiesPanelOpen: boolean;
  isAiAssistantOpen: boolean;

  setSidebarPanel: (panel: SidebarPanel) => void;
  toggleSidebar: () => void;
  openPropertiesPanel: () => void;
  closePropertiesPanel: () => void;
  toggleAiAssistant: () => void;
}

export const createUISlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
): UISlice => ({
  sidebarPanel: "components",
  isSidebarOpen: true,
  isPropertiesPanelOpen: false,
  isAiAssistantOpen: false,

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
});
