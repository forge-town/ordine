import { describe, expect, it, vi } from "vitest";
import type { FinalConnectionState } from "@xyflow/system";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode } from "./canvasSlice";

const canvasDataProviderMocks = vi.hoisted(() => ({
  update: vi.fn(async () => ({ data: { id: "pipeline-1" } })),
  custom: vi.fn(async () => ({ data: { jobId: "job-1" } })),
}));

vi.mock("../../../lib/canvasDataProvider", () => ({
  getCanvasDataProvider: () => canvasDataProviderMocks,
}));

const makeNode = (id: string, type: PipelineNode["type"]): PipelineNode =>
  ({
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label: id, nodeType: type },
  }) as PipelineNode;

const makeFileNode = (id: string): PipelineNode =>
  ({
    id,
    type: "file",
    position: { x: 0, y: 0 },
    data: {
      label: "main.ts",
      nodeType: "file",
      filePath: "src/main.ts",
      language: "typescript",
      description: "entry file",
    },
  }) as PipelineNode;

const makeFolderNode = (id: string): PipelineNode =>
  ({
    id,
    type: "folder",
    position: { x: 0, y: 0 },
    data: {
      label: "src",
      nodeType: "folder",
      folderPath: "apps/app/src",
      description: "source folder",
      excludedPaths: [],
    },
  }) as PipelineNode;

const makeOutputLocalPathNode = (id: string): PipelineNode =>
  ({
    id,
    type: "output-local-path",
    position: { x: 0, y: 0 },
    data: {
      label: "report",
      nodeType: "output-local-path",
      localPath: "/tmp/output",
      outputFileName: "report.md",
      outputMode: "overwrite",
      description: "write report locally",
    },
  }) as PipelineNode;

describe("canvas connection actions", () => {
  it("records a completed node drag as one undoable move", () => {
    const node = makeNode("movable", "file");
    const store = createCanvasPageStore([node], [], null, "");

    store.getState().handleFlowNodeDragStart({} as React.MouseEvent, node, [node]);
    store.getState().handleNodesChange([
      {
        id: node.id,
        type: "position",
        position: { x: 240, y: 96 },
        dragging: true,
      },
    ]);
    const movedNode = store.getState().nodes[0]!;
    store.getState().handleFlowNodeDragStop({} as React.MouseEvent, movedNode, [movedNode]);

    expect(store.getState().nodes[0]?.position).toEqual({ x: 240, y: 96 });
    expect(store.getState()._history).toHaveLength(1);
    expect(store.getState()._history[0]?.command.type).toBe("MOVE_NODE");

    store.getState().handleUndo();
    expect(store.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });

    store.getState().handleRedo();
    expect(store.getState().nodes[0]?.position).toEqual({ x: 240, y: 96 });
  });

  it("keeps the dragged source handle when creating a connected node", () => {
    const source = makeNode("source", "operation");
    const target = makeNode("target", "output-local-path");
    const store = createCanvasPageStore([source], [], null, "");

    store.getState().handleConnectStart({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });

    store.getState().addNodeAndAutoConnect(target);

    expect(store.getState().edges).toEqual([
      expect.objectContaining({
        source: source.id,
        sourceHandle: "right-port-2",
        target: target.id,
      }),
    ]);
    expect(store.getState().edges[0]?.targetHandle ?? null).toBeNull();
    expect(store.getState().connectStart).toBeNull();
  });

  it("can undo and redo a created connection", () => {
    const source = makeNode("source", "file");
    const target = makeNode("target", "operation");
    const store = createCanvasPageStore([source, target], [], null, "");

    store.getState().handleConnect({
      source: source.id,
      sourceHandle: null,
      target: target.id,
      targetHandle: null,
    });

    expect(store.getState().edges).toHaveLength(1);
    expect(() => store.getState().handleUndo()).not.toThrow();
    expect(store.getState().edges).toEqual([]);
    expect(() => store.getState().handleRedo()).not.toThrow();
    expect(store.getState().edges).toEqual([
      expect.objectContaining({
        source: source.id,
        target: target.id,
      }),
    ]);
  });

  it("keeps the dragged target handle when creating a connected upstream node", () => {
    const source = makeNode("source", "folder");
    const target = makeNode("target", "operation");
    const store = createCanvasPageStore([target], [], null, "");

    store.getState().handleConnectStart({
      nodeId: target.id,
      handleId: "left-port-1",
      handleType: "target",
    });

    store.getState().addNodeAndAutoConnect(source);

    expect(store.getState().edges).toEqual([
      expect.objectContaining({
        source: source.id,
        target: target.id,
        targetHandle: "left-port-1",
      }),
    ]);
    expect(store.getState().edges[0]?.sourceHandle ?? null).toBeNull();
    expect(store.getState().connectStart).toBeNull();
  });

  it("falls back to the original connect start handle when connect end omits handle id", () => {
    const source = makeNode("source", "operation");
    const store = createCanvasPageStore([source], [], null, "");

    store.getState().handleConnectStart({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });

    store.getState().handleFlowConnectEnd(
      { clientX: 100, clientY: 200 } as MouseEvent,
      {
        isValid: null,
        fromNode: { id: source.id },
        fromHandle: { id: null, type: "source" },
      } as FinalConnectionState,
    );

    expect(store.getState().connectStart).toEqual({
      nodeId: source.id,
      handleId: "right-port-2",
      handleType: "source",
    });
    expect(store.getState().connectionMenu).toEqual({
      screenX: 100,
      screenY: 200,
      flowX: 100,
      flowY: 200,
    });
  });

  it("clears connect start instead of opening the connection menu without a handle type", () => {
    const source = makeNode("source", "operation");
    const store = createCanvasPageStore([source], [], null, "");

    store.getState().handleConnectStart({
      nodeId: source.id,
      handleId: "right-port-0",
      handleType: null,
    });

    store.getState().handleFlowConnectEnd(
      { clientX: 100, clientY: 200 } as MouseEvent,
      {
        isValid: null,
        fromNode: { id: source.id },
        fromHandle: { id: "right-port-0", type: null },
      } as unknown as FinalConnectionState,
    );

    expect(store.getState().connectStart).toBeNull();
    expect(store.getState().connectionMenu).toBeNull();
  });
});

describe("canvas run actions", () => {
  it("passes the selected runtime and model to the pipeline run request", async () => {
    canvasDataProviderMocks.update.mockClear();
    canvasDataProviderMocks.custom.mockClear();
    const store = createCanvasPageStore([], [], "pipeline-1", "Selected runtime pipeline");

    await store.getState().handleRunTest({
      runtimeConfigId: "local-codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "xhigh",
      speed: "priority",
    });

    expect(canvasDataProviderMocks.custom).toHaveBeenCalledWith({
      url: "pipelines/run",
      method: "post",
      payload: {
        id: "pipeline-1",
        runtimeConfigId: "local-codex",
        model: "gpt-5.6-luna",
        reasoningEffort: "xhigh",
        speed: "priority",
      },
    });
    expect(store.getState()).toEqual(
      expect.objectContaining({ activeJobId: "job-1", isConsoleOpen: true, isRunning: false }),
    );
  });

  it("cancels the active job and leaves its console available", async () => {
    canvasDataProviderMocks.custom.mockClear();
    const store = createCanvasPageStore([], [], "pipeline-1", "Cancelable pipeline");
    store.setState({ activeJobId: "job-1", isConsoleOpen: true, isTestRunning: true });

    await expect(store.getState().handleCancelRun()).resolves.toBe(true);

    expect(canvasDataProviderMocks.custom).toHaveBeenCalledWith({
      url: "jobs/cancel",
      method: "post",
      payload: { jobId: "job-1" },
    });
    expect(store.getState()).toEqual(
      expect.objectContaining({
        activeJobId: "job-1",
        isConsoleOpen: true,
        isTestRunning: false,
      }),
    );
  });
});

describe("semantic node field actions", () => {
  it("updates file, folder, and local output fields from plain values", () => {
    const fileNode = makeFileNode("file-1");
    const folderNode = makeFolderNode("folder-1");
    const outputNode = makeOutputLocalPathNode("output-1");
    const store = createCanvasPageStore([fileNode, folderNode, outputNode], [], null, "");
    const state = store.getState();

    expect(() =>
      state.handleFilePathInputChange(fileNode.id, "src/next.tsx" as never),
    ).not.toThrow();
    expect(() =>
      state.handleFolderPathInputChange(folderNode.id, "apps/app/components" as never),
    ).not.toThrow();
    expect(() =>
      state.handleOutputLocalPathInputChange(outputNode.id, "/workspace/reports" as never),
    ).not.toThrow();
    expect(() =>
      state.handleOutputLocalPathFileNameInputChange(outputNode.id, "summary.md" as never),
    ).not.toThrow();
    expect(() =>
      state.handleOutputLocalPathModeChange(outputNode.id, "auto_rename" as never),
    ).not.toThrow();
    expect(() =>
      state.handleOutputLocalPathDescriptionInputChange(
        outputNode.id,
        "store action takes plain values" as never,
      ),
    ).not.toThrow();

    const nextState = store.getState();
    const updatedFileNode = nextState.nodes.find((node) => node.id === fileNode.id);
    const updatedFolderNode = nextState.nodes.find((node) => node.id === folderNode.id);
    const updatedOutputNode = nextState.nodes.find((node) => node.id === outputNode.id);

    expect(updatedFileNode?.data).toEqual(expect.objectContaining({ filePath: "src/next.tsx" }));
    expect(updatedFolderNode?.data).toEqual(
      expect.objectContaining({ folderPath: "apps/app/components" }),
    );
    expect(updatedOutputNode?.data).toEqual(
      expect.objectContaining({
        localPath: "/workspace/reports",
        outputFileName: "summary.md",
        outputMode: "auto_rename",
        description: "store action takes plain values",
      }),
    );
  });
});
