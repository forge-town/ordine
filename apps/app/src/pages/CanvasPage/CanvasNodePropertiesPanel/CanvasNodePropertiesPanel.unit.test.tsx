import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasNodePropertiesPanel } from "./CanvasNodePropertiesPanel";

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

const renderPanel = () => {
  const store = createCanvasPageStore([fileNode]);
  store.setState({ selectedNodeId: fileNode.id, sidebarPanel: "properties" });

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
});
