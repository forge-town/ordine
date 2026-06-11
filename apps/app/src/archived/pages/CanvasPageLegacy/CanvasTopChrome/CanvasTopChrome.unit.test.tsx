import { render } from "@/test/test-wrapper";
import i18n from "@/lib/i18n";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasTopChrome } from "./CanvasTopChrome";

const compoundNode = {
  id: "compound-1",
  type: "compound",
  position: { x: 0, y: 0 },
  data: {
    label: "Review Council",
    nodeType: "compound",
    compoundKind: "council",
    childNodeIds: [],
    childEdges: [],
  },
} as PipelineNode;

const renderTopChrome = (setup?: (store: ReturnType<typeof createCanvasPageStore>) => void) => {
  const store = createCanvasPageStore([compoundNode], [], "pipe-test", "Draft pipeline");
  setup?.(store);

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasTopChrome />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasTopChrome", () => {
  it("renders a centered pill with editable title and Run button", () => {
    renderTopChrome();

    expect(screen.getByTestId("canvas-top-chrome")).toHaveClass(
      "border-b",
      "bg-background/95",
      "backdrop-blur",
    );
    expect(screen.queryByTestId("canvas-toolbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-title-desktop")).toHaveClass(
      "max-w-[760px]",
      "rounded-full",
      "shadow-soft",
    );
    expect(screen.getByRole("button", { name: i18n.t("canvas.run") })).toBeDisabled();
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

  it("enables Run only after the workspace is applied or done", async () => {
    const user = userEvent.setup();
    const handleRunTest = vi.fn();
    renderTopChrome((store) => {
      store.setState({ handleRunTest, phase: "applied" });
    });

    const runButton = screen.getByRole("button", { name: i18n.t("canvas.run") });
    expect(runButton).not.toBeDisabled();

    await user.click(runButton);

    expect(handleRunTest).toHaveBeenCalledTimes(1);
  });

  it("shows a running indicator while a job is active", () => {
    renderTopChrome((store) => {
      store.setState({ phase: "running", isTestRunning: true });
    });

    const runningButton = screen.getByRole("button", {
      name: i18n.t("canvas.runningStatus"),
    });
    expect(runningButton).toBeDisabled();
    expect(runningButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders drill breadcrumbs and exits to the selected depth", async () => {
    const user = userEvent.setup();
    const store = renderTopChrome((targetStore) => {
      targetStore.setState({ drillStack: ["compound-1"] });
    });

    expect(screen.getByRole("button", { name: "Root" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Council" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Root" }));

    expect(store.getState().drillStack).toEqual([]);
  });
});
