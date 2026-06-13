import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";
import { NodeConfig } from "./NodeConfig";

const updateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useList: ({ resource }: { resource: string }) => ({
    result: {
      data:
        resource === "agentRuntimes"
          ? [{ id: "runtime-codex", name: "Codex runtime", type: "codex" }]
          : resource === "skills"
            ? [{ id: "review-skill", name: "review-skill", label: "Review Skill" }]
            : [],
    },
  }),
  useUpdate: () => ({ mutate: updateMock }),
}));

const operationNode = {
  id: "operation-1",
  type: "operation",
  position: { x: 0, y: 0 },
  data: {
    label: "Review",
    nodeType: "operation",
    operationId: "review",
    operationName: "Review",
    status: "idle",
    loopConditionPrompt: "Check docs",
  },
} as PipelineNode;

const promptNode = {
  id: "prompt-1",
  type: "prompt",
  position: { x: 0, y: 0 },
  data: {
    label: "Brief",
    nodeType: "prompt",
    prompt: "Summarize",
  },
} as PipelineNode;

const edge = {
  id: "edge-a",
  source: "prompt-1",
  target: "operation-1",
  data: { label: "brief" },
} as PipelineEdge;

const makeWrapper =
  (store: CanvasPageStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
  );

const renderConfig = (node: PipelineNode, edges: PipelineEdge[] = []) => {
  updateMock.mockReset();
  const store = createCanvasPageStore([promptNode, operationNode], edges, "pipe-1", "Pipeline");
  store.setState({ configNodeId: node.id });

  render(<NodeConfig />, { wrapper: makeWrapper(store) });

  return store;
};

describe("NodeConfig", () => {
  it("updates operation label and persists the node snapshot", () => {
    const store = renderConfig(operationNode, [edge]);

    fireEvent.change(screen.getByRole("textbox", { name: "Label" }), {
      target: { value: "Review Docs" },
    });

    expect(store.getState().nodes.find((node) => node.id === operationNode.id)?.data).toEqual(
      expect.objectContaining({
        label: "Review Docs",
        operationName: "Review Docs",
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "pipelines",
        id: "pipe-1",
        values: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: operationNode.id,
              data: expect.objectContaining({ label: "Review Docs" }),
            }),
          ]),
        }),
      }),
    );
  });

  it("writes checkpoint state for operation nodes", () => {
    const store = renderConfig(operationNode);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(store.getState().nodes.find((node) => node.id === operationNode.id)?.data).toEqual(
      expect.objectContaining({ checkpoint: true }),
    );
  });

  it("edits prompt node text", () => {
    const store = renderConfig(promptNode);

    fireEvent.change(screen.getByRole("textbox", { name: "Prompt text" }), {
      target: { value: "Summarize the repo" },
    });

    expect(store.getState().nodes.find((node) => node.id === promptNode.id)?.data).toEqual(
      expect.objectContaining({ prompt: "Summarize the repo" }),
    );
  });

  it("closes the config panel", () => {
    const store = renderConfig(operationNode);

    fireEvent.click(screen.getByRole("button", { name: "Close Node Config" }));

    expect(store.getState().configNodeId).toBeNull();
  });
});
