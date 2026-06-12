import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";
import type { PipelineActionProposal } from "@repo/schemas";
import { createGraphSlice, type GraphSlice } from "./graphSlice";
import { createPanelSlice, type PanelSlice } from "./panelSlice";
import { createProposalSlice, type ProposalSlice } from "./proposalSlice";
import { createSelectionSlice, type SelectionSlice } from "./selectionSlice";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

type TestStoreState = GraphSlice & PanelSlice & ProposalSlice & SelectionSlice;

const makeNode = (id: string): CanvasNode => ({
  id,
  type: "operation",
  position: { x: 0, y: 0 },
  data: {
    label: id,
    nodeType: "operation",
    operationId: `op-${id}`,
    operationName: id,
    status: "idle",
  },
});

const makeEdge = (id: string, source: string, target: string): CanvasEdge => ({
  id,
  source,
  target,
  data: { label: id },
});

const createTestStore = () =>
  createStore<TestStoreState>()((set, get, store) => ({
    ...createGraphSlice({
      edges: [makeEdge("edge-a", "node-a", "node-b")],
      nodes: [makeNode("node-a"), makeNode("node-b")],
    })(set, get, store),
    ...createPanelSlice<TestStoreState>()(set, get, store),
    ...createSelectionSlice<TestStoreState>()(set, get, store),
    ...createProposalSlice<TestStoreState>()(set, get, store),
  }));

const removeNodeProposal = (nodeId: string): PipelineActionProposal => ({
  summary: `Remove ${nodeId}`,
  actions: [{ type: "removeNode", nodeId }],
});

describe("proposalSlice", () => {
  it("applies the pending proposal and clears interaction state", () => {
    const store = createTestStore();
    const proposal = removeNodeProposal("node-a");

    store.getState().setPendingProposal(proposal);
    store.getState().selectNode("node-a");
    store.getState().openNodeConfig("node-a");

    const applied = store.getState().applyPendingProposal();

    expect(applied).toBe(true);
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-b"]);
    expect(store.getState().edges).toEqual([]);
    expect(store.getState().pendingProposal).toBeNull();
    expect(store.getState().proposalDiagnostics).toBeNull();
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().configNodeId).toBeNull();
  });

  it("keeps the graph and exposes diagnostics when a proposal fails", () => {
    const store = createTestStore();
    const proposal = removeNodeProposal("missing-node");

    store.getState().setPendingProposal(proposal);
    const applied = store.getState().applyPendingProposal();

    expect(applied).toBe(false);
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().pendingProposal).toEqual(proposal);
    expect(store.getState().proposalDiagnostics).toEqual([
      expect.objectContaining({
        actionIndex: 0,
        code: "NODE_NOT_FOUND",
        severity: "error",
      }),
    ]);
  });

  it("rejects and clears a pending proposal", () => {
    const store = createTestStore();

    store
      .getState()
      .setPendingProposal(removeNodeProposal("node-a"), [
        { actionIndex: 0, code: "NODE_NOT_FOUND", message: "missing", severity: "error" },
      ]);
    store.getState().rejectProposal();

    expect(store.getState().pendingProposal).toBeNull();
    expect(store.getState().proposalDiagnostics).toBeNull();
    expect(store.getState().proposalPreview).toBeNull();
  });

  it("computes a canvas preview with diff badges when a proposal arrives", () => {
    const store = createTestStore();
    const proposal: PipelineActionProposal = {
      summary: "Add node-c after node-b",
      actions: [
        { type: "addNode", node: makeNode("node-c") },
        { type: "addEdge", edge: makeEdge("edge-b", "node-b", "node-c") },
      ],
    };

    store.getState().setPendingProposal(proposal);

    const preview = store.getState().proposalPreview;
    expect(preview).not.toBeNull();
    expect(preview?.nodes.map((node) => node.id)).toEqual(["node-a", "node-b", "node-c"]);
    expect(preview?.diffById).toEqual({ "node-a": "reuse", "node-b": "reuse", "node-c": "new" });
    expect(preview?.newEdgeIds).toEqual(["edge-b"]);
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
  });

  it("leaves the preview null when proposal actions cannot apply", () => {
    const store = createTestStore();

    store.getState().setPendingProposal(removeNodeProposal("missing-node"));

    expect(store.getState().pendingProposal).not.toBeNull();
    expect(store.getState().proposalPreview).toBeNull();
  });

  it("clears the preview after the proposal is applied", () => {
    const store = createTestStore();

    store.getState().setPendingProposal(removeNodeProposal("node-a"));
    expect(store.getState().proposalPreview).not.toBeNull();

    store.getState().applyPendingProposal();

    expect(store.getState().proposalPreview).toBeNull();
  });
});
