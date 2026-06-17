import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../../_store/canvasStore";
import type { CanvasNode } from "../../_store/canvasTypes";
import { LastRunSection } from "./LastRunSection";

const node: CanvasNode = {
  data: {
    config: {},
    label: "Gen",
    nodeType: "operation",
    operationId: "op-1",
    operationName: "Gen",
    status: "idle",
  },
  id: "n1",
  position: { x: 0, y: 0 },
  type: "operation",
};

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

const renderWith = (set: (s: CanvasStore) => void) => {
  const store = createCanvasStore({ nodes: [node] });
  set(store);
  render(<LastRunSection edges={[]} node={node} onPatch={() => {}} />, {
    wrapper: makeWrapper(store),
  });
};

describe("LastRunSection", () => {
  it("renders only the inline preview when there is just LLM text", () => {
    renderWith((s) => s.getState().applyNodeLlmContent("n1", "# answer"));
    expect(screen.getAllByTestId("artifact-preview")).toHaveLength(1);
    expect(screen.getByTestId("artifact-renderer-markdown")).toBeInTheDocument();
  });

  it("renders BOTH the LLM text and the dir artifact (text channel not hidden)", () => {
    renderWith((s) => {
      s.getState().applyNodeLlmContent("n1", "# answer");
      s.getState().applyNodeArtifact("n1", {
        kind: "dir",
        contentType: "text",
        content: "/out",
        files: [],
      });
    });
    // 两个 ArtifactPreview：一个 inline 文本，一个 dir 文件树——互不遮挡
    expect(screen.getAllByTestId("artifact-preview")).toHaveLength(2);
    expect(screen.getByTestId("artifact-renderer-markdown")).toBeInTheDocument();
  });

  it("shows the no-output hint when neither exists", () => {
    renderWith(() => {});
    expect(screen.queryAllByTestId("artifact-preview")).toHaveLength(0);
  });
});
