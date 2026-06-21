import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { OutputLocalPathNode } from "./OutputLocalPathNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "test",
  useUpdateNodeInternals: () => () => undefined,
}));

vi.mock("@/components/FolderBrowserDialog/FolderBrowserDialog", () => ({
  FolderBrowserDialog: ({
    onSelect: handleSelect,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (path: string) => void;
  }) => (
    <button type="button" onClick={() => handleSelect("/workspace/from-browser")}>
      mock-select-folder
    </button>
  ),
}));

const baseData = {
  nodeType: "output-local-path" as const,
  label: "Write Local Report",
  localPath: "/workspace/ordine/output",
  outputFileName: "review.md",
  outputMode: "overwrite" as const,
  description: "Writes the review result to a local markdown file.",
};

const makeStore = (data = baseData, id = "test"): CanvasPageStore => {
  const store = createCanvasPageStore([
    {
      id,
      type: "output-local-path",
      position: { x: 0, y: 0 },
      data,
    },
  ]);
  store.setState({ nodeCardMode: "expanded" });

  return store;
};

const makeWrapper =
  (store: CanvasPageStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
  );

describe("OutputLocalPathNode", () => {
  it("renders the local path, file name, and description", () => {
    render(<OutputLocalPathNode data={baseData} id="test" />, {
      wrapper: makeWrapper(makeStore()),
    });

    expect(screen.getByDisplayValue("/workspace/ordine/output")).toBeInTheDocument();
    expect(screen.getByDisplayValue("review.md")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Writes the review result to a local markdown file."),
    ).toBeInTheDocument();
  });

  it("writes the typed local path back to the store as a plain string", () => {
    const store = makeStore();
    render(<OutputLocalPathNode data={baseData} id="test" />, {
      wrapper: makeWrapper(store),
    });

    fireEvent.change(screen.getByDisplayValue("/workspace/ordine/output"), {
      target: { value: "/workspace/reports" },
    });

    const updatedNode = store.getState().nodes.find((node) => node.id === "test");
    expect(updatedNode?.data).toEqual(expect.objectContaining({ localPath: "/workspace/reports" }));
  });

  it("writes the browser-selected path back to the store", async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(<OutputLocalPathNode data={baseData} id="test" />, {
      wrapper: makeWrapper(store),
    });

    await user.click(screen.getByRole("button", { name: "mock-select-folder" }));

    const updatedNode = store.getState().nodes.find((node) => node.id === "test");
    expect(updatedNode?.data).toEqual(
      expect.objectContaining({ localPath: "/workspace/from-browser" }),
    );
  });
});
