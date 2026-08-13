import { describe, expect, it } from "vitest";
import type { PipelineGraphSnapshot, PipelineAction } from "@repo/schemas";
import { applyPipelineActions, validatePipelineActions } from "./applyPipelineActions";
import { makeEdge } from "../tests/helpers/makeEdge";
import { makeNode } from "../tests/helpers/makeNode";

const makeSnapshot = (
  nodes: PipelineGraphSnapshot["nodes"] = [],
  edges: PipelineGraphSnapshot["edges"] = [],
): PipelineGraphSnapshot => ({
  nodes,
  edges,
});

describe("validatePipelineActions", () => {
  it("rejects actions that involve compound nodes", () => {
    const snapshot = makeSnapshot([makeNode("compound-1", "compound")]);
    const actions: PipelineAction[] = [{ type: "removeNode", nodeId: "compound-1" }];

    const result = validatePipelineActions(snapshot, actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COMPOUND_NODE_NOT_SUPPORTED",
          actionIndex: 0,
        }),
      ]),
    );
  });

  it("rejects actions that involve child nodes", () => {
    const childNode = { ...makeNode("child-1", "operation"), parentId: "compound-1" };
    const snapshot = makeSnapshot([childNode]);
    const actions: PipelineAction[] = [
      { type: "replaceNodeData", nodeId: "child-1", data: childNode.data },
    ];

    const result = validatePipelineActions(snapshot, actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CHILD_NODE_NOT_SUPPORTED",
          actionIndex: 0,
        }),
      ]),
    );
  });
});

describe("applyPipelineActions", () => {
  it("validates updateOperation against the current graph without changing it", () => {
    const operationNode = {
      id: "operation-node",
      type: "operation" as const,
      position: { x: 0, y: 0 },
      data: {
        nodeType: "operation" as const,
        label: "Review",
        operationId: "op-review",
        operationName: "Review",
        status: "idle" as const,
      },
    };
    const snapshot = makeSnapshot([operationNode]);
    const result = applyPipelineActions(snapshot, [
      {
        type: "updateOperation",
        operationId: "op-review",
        executor: {
          type: "agent",
          agentMode: "prompt",
          agent: "codex",
          model: "gpt-review",
          prompt: "Review the input.",
          allowedTools: [],
          assignmentReason: "Semantic review requires an agent.",
        },
      },
    ]);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(snapshot);
  });

  it("rejects updateOperation for an operation outside the current graph", () => {
    const result = applyPipelineActions(makeSnapshot(), [
      {
        type: "updateOperation",
        operationId: "op-missing",
        executor: {
          type: "script",
          language: "bash",
          command: "bun run lint",
          assignmentReason: "Linting is a deterministic local command.",
        },
      },
    ]);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual([
      expect.objectContaining({ code: "OPERATION_NOT_FOUND", actionIndex: 0 }),
    ]);
  });

  it("applies sequential addNode then addEdge actions", () => {
    const folderNode = makeNode("folder-1", "folder");
    const actionNode = makeNode("action-1", "operation", {
      operationId: "op-1",
      operationName: "operation 1",
    });
    const actions: PipelineAction[] = [
      { type: "addNode", node: actionNode },
      {
        type: "addEdge",
        edge: { ...makeEdge("folder-1", "action-1"), sourceHandle: null, targetHandle: null },
      },
    ];

    const result = applyPipelineActions(makeSnapshot([folderNode]), actions);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({
      nodes: [folderNode, actionNode],
      edges: [
        expect.objectContaining({
          source: "folder-1",
          target: "action-1",
        }),
      ],
    });
  });

  it("rejects edges that reference missing nodes", () => {
    const snapshot = makeSnapshot([makeNode("folder-1", "folder")]);
    const actions: PipelineAction[] = [{ type: "addEdge", edge: makeEdge("folder-1", "missing") }];

    const result = applyPipelineActions(snapshot, actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "NODE_NOT_FOUND",
          actionIndex: 0,
        }),
      ]),
    );
    expect(snapshot).toEqual(makeSnapshot([makeNode("folder-1", "folder")]));
  });

  it("rejects invalid connection rules", () => {
    const snapshot = makeSnapshot([
      makeNode("output-1", "output-local-path"),
      makeNode("action-1", "operation", { operationId: "op-1", operationName: "operation 1" }),
    ]);
    const actions: PipelineAction[] = [{ type: "addEdge", edge: makeEdge("output-1", "action-1") }];

    const result = applyPipelineActions(snapshot, actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_CONNECTION",
          actionIndex: 0,
        }),
      ]),
    );
  });

  it("rejects duplicate node ids", () => {
    const existing = makeNode("action-1", "operation", {
      operationId: "op-1",
      operationName: "operation 1",
    });
    const actions: PipelineAction[] = [{ type: "addNode", node: existing }];

    const result = applyPipelineActions(makeSnapshot([existing]), actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DUPLICATE_NODE_ID",
          actionIndex: 0,
        }),
      ]),
    );
  });

  it("rejects added nodes whose React Flow type does not match data.nodeType", () => {
    const mismatched = makeNode("action-1", "operation", {
      nodeType: "folder",
      folderPath: "/tmp/source",
    });
    const actions: PipelineAction[] = [{ type: "addNode", node: mismatched }];

    const result = applyPipelineActions(makeSnapshot(), actions);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_NODE_DATA",
          actionIndex: 0,
        }),
      ]),
    );
  });

  it("keeps the graph unchanged when a later action in the batch fails", () => {
    const snapshot = makeSnapshot([makeNode("folder-1", "folder")]);
    const actionNode = makeNode("action-1", "operation", {
      operationId: "op-1",
      operationName: "operation 1",
    });
    const actions: PipelineAction[] = [
      { type: "addNode", node: actionNode },
      { type: "addEdge", edge: makeEdge("action-1", "missing") },
    ];

    const result = applyPipelineActions(snapshot, actions);

    expect(result.isErr()).toBe(true);
    expect(snapshot).toEqual(makeSnapshot([makeNode("folder-1", "folder")]));
  });

  it("preserves provided operationName when an operation node label changes", () => {
    const operationNode = makeNode("action-1", "operation", {
      label: "Old Label",
      operationId: "op-1",
      operationName: "Canonical Name",
    });
    const result = applyPipelineActions(makeSnapshot([operationNode]), [
      {
        type: "replaceNodeData",
        nodeId: "action-1",
        data: {
          ...operationNode.data,
          label: "New Label",
        },
      },
    ]);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().nodes[0]?.data).toEqual(
      expect.objectContaining({
        label: "New Label",
        operationName: "Canonical Name",
      }),
    );
  });
});
