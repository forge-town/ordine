import { render } from "../../../test/test-wrapper";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasNodePropertiesPanel } from "./CanvasNodePropertiesPanel";

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@refinedev/core")>()),
  useList: ({ resource }: { resource: string }) => ({
    result: {
      data:
        resource === "agents"
          ? [{ id: "agent-claude", name: "Claude", defaultRuntime: "claude-code" }]
          : [],
    },
  }),
}));

vi.mock("./CanvasOperationPropertiesForm", () => ({
  CanvasOperationPropertiesForm: ({
    operationId,
    onOperationUpdated,
  }: {
    operationId: string;
    onOperationUpdated?: (operation: {
      id: string;
      name: string;
      description: string;
      acceptedObjectTypes: ["file"];
      config: {};
    }) => void;
  }) =>
    (() => {
      const handleApplyOperationUpdate = () =>
        onOperationUpdated?.({
          id: operationId,
          name: "Renamed Operation",
          description: "",
          acceptedObjectTypes: ["file"],
          config: {},
        });

      return (
        <button type="button" onClick={handleApplyOperationUpdate}>
          Apply operation update
        </button>
      );
    })(),
}));

const fileNode = {
  id: "file-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "",
  },
} as PipelineNode;

const operationNode = {
  id: "operation-1",
  type: "operation",
  position: { x: 0, y: 0 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "idle",
    config: {},
    loopEnabled: true,
    maxLoopCount: 3,
    loopConditionPrompt: "",
    agentRuntime: "codex",
  },
} as PipelineNode;

const folderNode = {
  id: "folder-1",
  type: "folder",
  position: { x: 0, y: 0 },
  data: {
    label: "Source Folder",
    nodeType: "folder",
    folderPath: "src",
    disclosureMode: "tree",
    includedExtensions: ["ts"],
    excludedPaths: ["dist"],
    description: "",
  },
} as PipelineNode;

const renderPanel = (node: PipelineNode = fileNode) => {
  const store = createCanvasPageStore([node]);
  store.setState({ selectedNodeId: node.id, sidebarPanel: "properties" });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasNodePropertiesPanel />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasNodePropertiesPanel", () => {
  it("edits selected file node data from the left panel", async () => {
    const user = userEvent.setup();
    const store = renderPanel();

    const pathInput = screen.getByRole("textbox", { name: /File path/i });

    await user.clear(pathInput);
    await user.type(pathInput, "src/app.tsx");

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        filePath: "src/app.tsx",
      }),
    );
  });

  it("returns to the component panel from properties", async () => {
    const user = userEvent.setup();
    const store = renderPanel();

    await user.click(screen.getByRole("button", { name: /Back to components/i }));

    expect(store.getState().sidebarPanel).toBe("components");
    expect(store.getState().selectedNodeId).toBeNull();
  });

  it("stores operation max loop count edits as a number", () => {
    const store = renderPanel(operationNode);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Max loop count/i }), {
      target: { value: "8" },
    });

    const data = store.getState().nodes[0]?.data as { maxLoopCount?: unknown };

    expect(data.maxLoopCount).toBe(8);
    expect(typeof data.maxLoopCount).toBe("number");
  });

  it("uses number input semantics for max loop count edits", () => {
    const store = renderPanel(operationNode);
    const input = screen.getByRole("spinbutton", { name: /Max loop count/i });
    const readMaxLoopCount = () =>
      (store.getState().nodes[0]?.data as { maxLoopCount?: unknown } | undefined)?.maxLoopCount;

    fireEvent.change(input, { target: { value: "1e2" } });
    expect(readMaxLoopCount()).toBe(20);

    fireEvent.change(input, { target: { value: "7.5" } });
    expect(readMaxLoopCount()).toBe(20);
  });

  it("keeps operation label and operationName in sync when editing the shared label field", async () => {
    const user = userEvent.setup();
    const store = renderPanel(operationNode);
    const labelInput = screen.getByRole("textbox", { name: /Label/i });

    await user.clear(labelInput);
    await user.type(labelInput, "Review Docs");

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        label: "Review Docs",
        operationName: "Review Docs",
      }),
    );
  });

  it("clears stale agentRuntime when choosing an operation agent from the properties panel", async () => {
    const user = userEvent.setup();
    const store = renderPanel(operationNode);

    await user.click(screen.getByRole("combobox", { name: /Agent/i }));
    await user.click(await screen.findByRole("option", { name: "Claude" }));

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        agentId: "agent-claude",
        agentRuntime: undefined,
      }),
    );
  });

  it("keeps operation label and operationName in sync after saving the embedded operation editor", async () => {
    const user = userEvent.setup();
    const store = renderPanel(operationNode);

    await user.click(screen.getByRole("button", { name: "Apply operation update" }));

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        label: "Renamed Operation",
        operationName: "Renamed Operation",
      }),
    );
  });

  it("gives included extensions and excluded paths fields accessible names", () => {
    renderPanel(folderNode);

    expect(screen.getByRole("textbox", { name: /Included extensions/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Excluded paths/i })).toBeInTheDocument();
  });

  it("parses included extensions by trimming values and dropping empties", () => {
    const store = renderPanel(folderNode);

    fireEvent.change(screen.getByRole("textbox", { name: /Included extensions/i }), {
      target: { value: " ts, ,tsx, js , " },
    });

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        includedExtensions: ["ts", "tsx", "js"],
      }),
    );
  });

  it("trims excluded paths, ignores duplicates, and removes paths", async () => {
    const user = userEvent.setup();
    const store = renderPanel(folderNode);
    const excludedPathsInput = screen.getByRole("textbox", { name: /Excluded paths/i });

    await user.type(excludedPathsInput, "  build  {enter}");

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        excludedPaths: ["dist", "build"],
      }),
    );

    await user.clear(excludedPathsInput);
    await user.type(excludedPathsInput, " dist {enter}");

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        excludedPaths: ["dist", "build"],
      }),
    );

    await user.click(screen.getByRole("button", { name: /dist/ }));

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        excludedPaths: ["build"],
      }),
    );
  });
});
