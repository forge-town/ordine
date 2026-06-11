import { fireEvent, render, screen } from "@testing-library/react";
import { Zap } from "lucide-react";
import i18n from "@/lib/i18n";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { CompoundNode } from "./CompoundNode";
import { FileNode } from "./FileNode";
import { GNodeShell } from "./GNodeShell";
import { OperationNode } from "./OperationNode";
import { OutputProjectPathNode } from "./OutputNode";
import { PromptNode } from "./PromptNode";

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, ...props }: { type: string; [key: string]: unknown }) => (
    <div data-handle-type={type} {...props} />
  ),
  Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
  useNodeId: () => "node-a",
  useUpdateNodeInternals: () => () => undefined,
}));

const fileData = {
  filePath: "src/source.ts",
  label: "Source file",
  language: "typescript",
  nodeType: "file" as const,
};

const operationData = {
  label: "Parse",
  nodeType: "operation" as const,
  operationId: "op-parse",
  operationName: "Parse PDF",
  status: "idle" as const,
};

const compoundData = {
  childEdges: [],
  childNodeIds: ["node-a", "node-b"],
  compoundKind: "verify" as const,
  label: "Verify group",
  nodeType: "compound" as const,
};

const makeFileCanvasNode = (id = "node-a"): CanvasNode => ({
  data: fileData,
  id,
  position: { x: 0, y: 0 },
  type: "file",
});

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

const makeStore = (nodes: CanvasNode[] = [makeFileCanvasNode()]) => createCanvasStore({ nodes });

describe("Canvas V2 node shell variants", () => {
  it("renders a regular node with graph metadata", () => {
    const store = makeStore();

    render(<FileNode data={fileData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByText("Source file")).toBeInTheDocument();
    expect(screen.getByText("src/source.ts")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-node-right-port")).toBeInTheDocument();
  });

  it("renders a compound node variant", () => {
    const store = makeStore();

    render(<CompoundNode data={compoundData} id="node-a" />, {
      wrapper: makeWrapper(store),
    });

    expect(screen.getByText("Verify group")).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("workspace.canvas.nodes.compound.childCount", { count: 2 })),
    ).toBeInTheDocument();
  });

  it("marks proposal nodes as previews", () => {
    const store = makeStore();
    store.getState().setPendingProposal({ actions: [], summary: "Preview" });

    render(<OperationNode data={operationData} id="node-a" />, {
      wrapper: makeWrapper(store),
    });

    expect(screen.getByText(i18n.t("workspace.canvas.nodes.previewBadge"))).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-node-card")).toHaveClass("opacity-80");
  });

  it("applies selected node styling", () => {
    const store = makeStore();

    render(<FileNode selected data={fileData} id="node-a" />, { wrapper: makeWrapper(store) });

    expect(screen.getByTestId("canvas-v2-node-card")).toHaveClass("ring-2");
  });

  it("renders a running node status light", () => {
    const store = makeStore();
    store.setState({ nodeRunStatuses: { "node-a": "running" } });

    render(<OperationNode data={operationData} id="node-a" />, {
      wrapper: makeWrapper(store),
    });

    expect(
      screen.getByLabelText(i18n.t("workspace.canvas.nodes.status.running")),
    ).toBeInTheDocument();
  });

  it("renders verify template roles with localized labels", () => {
    const store = makeStore();

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

    expect(screen.getAllByText(i18n.t("workspace.canvas.nodes.kind.port"))).toHaveLength(2);
    expect(
      screen.getByText(i18n.t("workspace.canvas.nodes.operation.qualityGateKind")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("workspace.canvas.nodes.prompt.compoundInput")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("workspace.canvas.nodes.operation.qualityGateDetail")),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t("workspace.canvas.nodes.output.compoundOutput")),
    ).toBeInTheDocument();
  });

  it("updates panel targets from interactive node controls", () => {
    const store = makeStore();

    render(
      <GNodeShell
        annotationCount={2}
        icon={Zap}
        id="node-a"
        kind="Operation"
        theme="violet"
        title="Parse"
      />,
      { wrapper: makeWrapper(store) },
    );

    fireEvent.click(screen.getByTestId("canvas-v2-node-configure"));
    expect(store.getState().configNodeId).toBe("node-a");

    fireEvent.click(screen.getByTestId("canvas-v2-node-annotate"));
    expect(store.getState().annotatingId).toBe("node-a");

    fireEvent.click(screen.getByTestId("canvas-v2-node-view-annotations"));
    expect(store.getState().viewingAnnId).toBe("node-a");
  });

  it("duplicates and deletes nodes through node controls", () => {
    const store = makeStore([makeFileCanvasNode("node-a")]);

    render(<FileNode data={fileData} id="node-a" />, { wrapper: makeWrapper(store) });

    fireEvent.click(screen.getByTestId("canvas-v2-node-duplicate"));
    expect(store.getState().nodes).toHaveLength(2);

    fireEvent.click(screen.getByTestId("canvas-v2-node-delete"));
    expect(store.getState().nodes.map((node) => node.id)).not.toContain("node-a");
  });
});
