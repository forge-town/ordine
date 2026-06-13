import { fireEvent, render, screen } from "@testing-library/react";
import type { Annotation } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import { CanvasAnnotationsContext, type UseAnnotationsResult } from "../annotations";
import { CompoundNode } from "./CompoundNode";
import { FileNode } from "./FileNode";
import { OperationNode } from "./OperationNode";
import { OutputProjectPathNode } from "./OutputNode";
import { PromptNode } from "./PromptNode";

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
  (store: CanvasPageStore, annotations?: UseAnnotationsResult) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>
      {annotations ? (
        <CanvasAnnotationsContext.Provider value={annotations}>
          {children}
        </CanvasAnnotationsContext.Provider>
      ) : (
        children
      )}
    </CanvasPageStoreContext.Provider>
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

  it("renders verify template roles with specialized labels", () => {
    const store = makeExpandedStore();

    render(
      <>
        <PromptNode
          data={{
            label: "Input Port",
            nodeType: "prompt",
            prompt: "{{input}}",
          }}
          id="node-input"
        />
        <OperationNode
          data={{
            label: "Quality Gate",
            nodeType: "operation",
            operationId: "",
            operationName: "Quality Gate",
            status: "idle",
          }}
          id="node-gate"
        />
        <OutputProjectPathNode
          data={{
            label: "Output Port",
            nodeType: "output-project-path",
            path: "",
          }}
          id="node-output"
        />
      </>,
      { wrapper: makeWrapper(store) },
    );

    expect(screen.getAllByText("Port")).toHaveLength(2);
    expect(screen.getByText("Gate")).toBeInTheDocument();
    expect(screen.getByText("Compound input")).toBeInTheDocument();
    expect(screen.getByText("Pass / revise")).toBeInTheDocument();
    expect(screen.getByText("Compound output")).toBeInTheDocument();
  });

  it("reads annotation counts from context and opens the viewer target", () => {
    const store = makeExpandedStore();
    const annotation = {
      author: "user",
      content: "Needs a source check",
      createdAt: new Date("2026-06-08T03:43:27.439Z"),
      id: "ann-1",
      pipelineId: "pipe-1",
      resolved: false,
      targetId: "node-a",
      targetType: "node",
      updatedAt: new Date("2026-06-08T03:43:27.439Z"),
    } satisfies Annotation;
    const annotations = {
      annotations: [annotation, { ...annotation, id: "ann-2", content: "Confirm output" }],
      annotationsByTargetId: new Map([
        ["node-a", [annotation, { ...annotation, id: "ann-2", content: "Confirm output" }]],
      ]),
      createAnnotation: vi.fn(),
      isCreating: false,
      isLoading: false,
      pipelineId: "pipe-1",
    } satisfies UseAnnotationsResult;

    render(<OperationNode data={operationData} id="node-a" />, {
      wrapper: makeWrapper(store, annotations),
    });

    const badge = screen.getByRole("button", { name: "View annotations" });
    expect(badge).toHaveTextContent("2");

    fireEvent.click(badge);

    expect(store.getState().viewingAnnId).toBe("node-a");
  });
});
