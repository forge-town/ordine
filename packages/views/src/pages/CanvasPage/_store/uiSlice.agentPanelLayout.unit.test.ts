import { describe, expect, it } from "vitest";
import { createCanvasPageStore } from "./canvasPageStore";

describe("uiSlice AgentPanel layout", () => {
  it("stores an independent, clamped right panel width", () => {
    const store = createCanvasPageStore();

    expect(store.getState().agentPanelWidth).toBe(344);

    store.getState().setAgentPanelWidth(240);
    expect(store.getState().agentPanelWidth).toBe(300);

    store.getState().setAgentPanelWidth(440);
    expect(store.getState().agentPanelWidth).toBe(440);

    store.getState().setAgentPanelWidth(640);
    expect(store.getState().agentPanelWidth).toBe(520);
  });

  it("toggles the right panel without changing the left panel selection", () => {
    const store = createCanvasPageStore();
    store.setState({ sidebarPanel: "properties" });

    expect(store.getState().agentPanel.isOpen).toBe(true);

    store.getState().toggleAgentPanel();

    expect(store.getState().agentPanel.isOpen).toBe(false);
    expect(store.getState().sidebarPanel).toBe("properties");

    store.getState().toggleAgentPanel();

    expect(store.getState().agentPanel.isOpen).toBe(true);
    expect(store.getState().sidebarPanel).toBe("properties");
  });

  it("keeps the active job attached when the console is hidden", () => {
    const store = createCanvasPageStore();
    store.setState({ activeJobId: "job-1", isConsoleOpen: true, isTestRunning: true });

    store.getState().handleCloseConsole();

    expect(store.getState()).toMatchObject({
      activeJobId: "job-1",
      isConsoleOpen: false,
      isTestRunning: true,
    });
  });
});
