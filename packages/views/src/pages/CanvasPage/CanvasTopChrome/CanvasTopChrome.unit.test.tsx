import { render } from "../../../test/test-wrapper";
import i18n from "i18next";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as RefineCore from "@refinedev/core";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import { CanvasTopChrome } from "./CanvasTopChrome";

const handleSaveMock = vi.hoisted(() => vi.fn());
const executionPickerMocks = vi.hoisted(() => ({
  choice: {
    runtimeConfigId: "local-codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "xhigh",
    speed: "priority",
  },
  persistChoice: vi.fn(),
  selectRuntime: vi.fn(),
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useList: () => ({ result: { data: [{ id: "runtime-1" }] } }),
}));

vi.mock("../useCanvasWorkspacePersistence", () => ({
  useCanvasWorkspacePersistence: () => ({ handleSave: handleSaveMock, isPending: false }),
}));

vi.mock("../../../components/AgentExecutionPicker", () => ({
  AgentExecutionPicker: () => (
    <button data-testid="agent-execution-picker-trigger" type="button">
      模型
    </button>
  ),
  useAgentExecutionChoice: () => ({
    catalog: [],
    choice: executionPickerMocks.choice,
    isLoading: false,
    persistChoice: executionPickerMocks.persistChoice,
    selectRuntime: executionPickerMocks.selectRuntime,
  }),
}));

const renderTopChrome = () => {
  const store = createCanvasPageStore([], []);

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasTopChrome />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasTopChrome", () => {
  it("renders the Alan-style top pill with the current title and actions", () => {
    renderTopChrome();

    expect(screen.getByTestId("canvas-top-chrome")).toHaveClass(
      "absolute",
      "pointer-events-none",
      "z-20",
      "items-start",
      "justify-between",
      "gap-2",
      "p-3",
      "min-[1181px]:pr-[calc(var(--canvas-agent-offset)+0.75rem)]",
      "max-[480px]:gap-1",
      "max-[480px]:p-2",
      "max-[480px]:pl-12",
    );
    expect(screen.getByTestId("canvas-top-chrome")).toHaveStyle({
      "--canvas-agent-offset": "344px",
    });
    expect(screen.getByTestId("canvas-title-desktop")).toHaveClass("min-w-0", "max-w-64", "flex-1");
    expect(screen.getByTestId("canvas-title-desktop").firstElementChild).toHaveClass(
      "min-w-0",
      "shadow-pill",
      "ring-1",
      "rounded-full",
    );
    expect(screen.getByTestId("canvas-top-left-pill")).toContainElement(
      screen.getByTestId("canvas-v2-save"),
    );
    expect(screen.getByTestId("canvas-top-left-pill")).toContainElement(
      screen.getByTestId("canvas-v2-settings"),
    );
    expect(screen.getByRole("textbox", { name: i18n.t("canvas.pipelineTitle") })).toHaveClass(
      "truncate",
      "flex-1",
      "max-[480px]:w-16",
    );
    const stateLegendTrigger = screen.getByTestId("canvas-v2-state-legend-trigger");
    const executionPicker = screen.getByTestId("canvas-v2-execution-picker");
    const runButton = screen.getByTestId("canvas-v2-run");
    expect(stateLegendTrigger).toBeInTheDocument();
    expect(executionPicker).toHaveTextContent("模型");
    expect(stateLegendTrigger).toHaveClass("max-[480px]:px-2");
    expect(runButton).toHaveClass("max-[480px]:px-2");
    expect(stateLegendTrigger.querySelector("span")).toHaveClass("max-[480px]:sr-only");
    expect(runButton.querySelector("span")).toHaveClass("max-[480px]:sr-only");
    expect(stateLegendTrigger.compareDocumentPosition(executionPicker)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(executionPicker.compareDocumentPosition(runButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("button", { name: /Save|保存/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run|运行/i })).toBeDisabled();
  });

  it("saves through the current workspace persistence action", async () => {
    const user = userEvent.setup();

    renderTopChrome();
    await user.click(screen.getByTestId("canvas-v2-save"));

    expect(handleSaveMock).toHaveBeenCalledOnce();
  });

  it("preserves pipeline title editing", async () => {
    const user = userEvent.setup();
    const store = renderTopChrome();
    const desktopTitleInput = screen.getByRole("textbox", {
      name: i18n.t("canvas.pipelineTitle"),
    });

    await user.clear(desktopTitleInput);
    await user.type(desktopTitleInput, "Aligned pipeline");

    expect(store.getState().pipelineName).toBe("Aligned pipeline");
  });

  it("wires settings and run to current store actions", async () => {
    const user = userEvent.setup();
    const handleRunTest = vi.fn(async () => {});
    const store = renderTopChrome();

    act(() => {
      store.setState({ handleRunTest, pipelineId: "pipeline-1" });
    });

    await user.click(screen.getByRole("button", { name: /Settings|设置/i }));
    expect(store.getState().isCanvasSettingsOpen).toBe(true);

    const runButton = screen.getByRole("button", { name: /Run|运行/i });
    expect(runButton).toBeEnabled();
    await user.click(runButton);
    expect(handleRunTest).toHaveBeenCalledWith(executionPickerMocks.choice);

    act(() => {
      store.setState({ isRunning: true });
    });
    expect(screen.getByRole("button", { name: /Running|运行中/i })).toBeDisabled();
  });

  it("shows the agent reopen pill and uses the current toggle action", async () => {
    const user = userEvent.setup();
    const store = renderTopChrome();

    act(() => {
      store.getState().toggleAgentPanel();
    });

    const agentButton = screen.getByRole("button", { name: /Agent|智能体/i });
    expect(agentButton).toBeInTheDocument();
    await user.click(agentButton);
    expect(store.getState().agentPanel.isOpen).toBe(true);
  });
});
