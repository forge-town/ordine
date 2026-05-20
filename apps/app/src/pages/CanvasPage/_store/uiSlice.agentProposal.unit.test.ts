import { beforeEach, describe, expect, it, vi } from "vitest";
import { err, ok } from "neverthrow";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineEdge, PipelineNode } from "./canvasSlice";
import type {
  PipelineActionDiagnostic,
  PipelineActionProposal,
} from "@repo/schemas";

const mockApplyPipelineActions = vi.fn();

vi.mock("@repo/pipeline-engine/actions", () => ({
  applyPipelineActions: (...args: unknown[]) => mockApplyPipelineActions(...args),
}));

const makeNode = (id: string, type = "folder"): PipelineNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { nodeType: type, label: id },
  }) as unknown as PipelineNode;

const makeEdge = (id: string, source: string, target: string): PipelineEdge =>
  ({
    id,
    source,
    target,
    type: "default",
    data: {},
  }) as unknown as PipelineEdge;

const makeProposal = (): PipelineActionProposal =>
  ({
    summary: "Agent proposal summary",
    actions: [{ type: "removeNode", nodeId: "node-a" }],
  }) as PipelineActionProposal;

describe("uiSlice applyAgentProposal", () => {
  beforeEach(() => {
    mockApplyPipelineActions.mockReset();
  });

  it("records one history entry, updates graph atomically, and clears interaction UI", () => {
    const nodeA = makeNode("node-a");
    const nodeB = makeNode("node-b");
    const edgeA = makeEdge("edge-a", "node-a", "node-a");
    const edgeB = makeEdge("edge-b", "node-b", "node-b");
    const proposal = makeProposal();
    const store = createCanvasPageStore([nodeA], [edgeA], "pipe-1", "Pipeline 1");

    store.setState({
      selectedNodeId: "node-a",
      selectedEdgeId: "edge-a",
      contextMenu: { screenX: 1, screenY: 1, flowX: 1, flowY: 1 },
      connectionMenu: { screenX: 2, screenY: 2, flowX: 2, flowY: 2 },
      nodeContextMenu: { screenX: 3, screenY: 3, nodeId: "node-a" },
      connectStart: { nodeId: "node-a", handleId: null, handleType: "source" },
      isQuickAddOpen: true,
      quickAddQuery: "op",
      agentPanel: {
        isOpen: true,
        pendingProposal: proposal,
        diagnostics: null,
        isLoading: false,
      },
    });

    mockApplyPipelineActions.mockReturnValue(ok({ nodes: [nodeB], edges: [edgeB] }));

    const applied = store.getState().applyAgentProposal(proposal);

    const state = store.getState();
    expect(applied).toBe(true);
    expect(state.nodes).toEqual([nodeB]);
    expect(state.edges).toEqual([edgeB]);
    expect(state._history).toHaveLength(1);
    expect(state._history.at(-1)?.command.type).toBe("APPLY_AGENT_PROPOSAL");
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
    expect(state.contextMenu).toBeNull();
    expect(state.connectionMenu).toBeNull();
    expect(state.nodeContextMenu).toBeNull();
    expect(state.connectStart).toBeNull();
    expect(state.isQuickAddOpen).toBe(false);
    expect(state.quickAddQuery).toBe("");
    expect(state.agentPanel.isOpen).toBe(true);
    expect(state.agentPanel.pendingProposal).toBeNull();
    expect(state.agentPanel.diagnostics).toBeNull();

    state.handleUndo();
    const undone = store.getState();
    expect(undone.nodes).toEqual([nodeA]);
    expect(undone.edges).toEqual([edgeA]);
  });

  it("keeps graph unchanged and exposes diagnostics when action application fails", () => {
    const nodeA = makeNode("node-a");
    const edgeA = makeEdge("edge-a", "node-a", "node-a");
    const proposal = makeProposal();
    const diagnostics: PipelineActionDiagnostic[] = [
      { code: "NODE_NOT_FOUND", severity: "error", message: "missing node", actionIndex: 0 },
    ];
    const store = createCanvasPageStore([nodeA], [edgeA], "pipe-1", "Pipeline 1");

    store.setState({
      agentPanel: {
        isOpen: true,
        pendingProposal: proposal,
        diagnostics: null,
        isLoading: false,
      },
    });

    mockApplyPipelineActions.mockReturnValue(err(diagnostics));

    const applied = store.getState().applyAgentProposal(proposal);

    const state = store.getState();
    expect(applied).toBe(false);
    expect(state.nodes).toEqual([nodeA]);
    expect(state.edges).toEqual([edgeA]);
    expect(state._history).toHaveLength(0);
    expect(state.agentPanel.pendingProposal).toEqual(proposal);
    expect(state.agentPanel.diagnostics).toEqual(diagnostics);
  });
});
