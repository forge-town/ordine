import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { CompoundNode } from "./CompoundNode";
import { FileNode } from "./FileNode";
import { OperationNode } from "./OperationNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  useNodeId: () => "node-a",
  useUpdateNodeInternals: () => () => undefined,
}));

const fileData = {
  nodeType: "file" as const,
  label: "Source file",
  filePath: "src/source.ts",
  language: "typescript",
};

const operationData = {
  nodeType: "operation" as const,
  label: "Parse",
  operationId: "op-parse",
  operationName: "Parse PDF",
  status: "idle" as const,
};

const compoundData = {
  nodeType: "compound" as const,
  label: "Verify group",
  compoundKind: "verify" as const,
  childNodeIds: ["node-a", "node-b"],
  childEdges: [],
};

const makeWrapper =
  (store: CanvasPageStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
  );

const makeExpandedStore = () => {
  const store = createCanvasPageStore();
  store.setState({ nodeCardMode: "expanded" });

  return store;
};

describe("GNodeShell variants", () => {
  it("renders a regular node with graph metadata", () => {
    const store = makeExpandedStore();

    render(<FileNode data={fileData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("Source file")).toBeInTheDocument();
    expect(screen.getByText("src/source.ts")).toBeInTheDocument();
  });

  it("renders a compound node variant", () => {
    const store = makeExpandedStore();

    render(<CompoundNode data={compoundData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("Verify group")).toBeInTheDocument();
    expect(screen.getByText("2 child nodes")).toBeInTheDocument();
  });

  it("marks proposal phase nodes as previews", () => {
    const store = makeExpandedStore();
    store.setState({ phase: "proposal" });

    render(<OperationNode data={operationData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getByTestId("gnode-shell")).toHaveClass("opacity-80");
  });

  it("applies selected node styling", () => {
    const store = makeExpandedStore();

    render(<FileNode selected data={fileData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByTestId("gnode-shell")).toHaveClass("ring-2");
  });

  it("renders a running node status light", () => {
    const store = makeExpandedStore();
    store.setState({ nodeRunStatuses: { "node-a": "running" } });

    render(<OperationNode data={operationData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByLabelText("Running")).toBeInTheDocument();
  });
});
