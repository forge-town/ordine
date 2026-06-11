import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { ComposeDialog } from "./ComposeDialog";

const makeNode = (id: string): PipelineNode =>
  ({
    id,
    position: { x: 0, y: 0 },
    selected: true,
    type: "operation",
    data: {
      label: id,
      nodeType: "operation",
      operationId: id,
      operationName: id,
    },
  }) as PipelineNode;

const renderDialog = () => {
  const store = createCanvasPageStore([makeNode("node-a"), makeNode("node-b")], []);
  store.getState().setComposingNodeIds(["node-a", "node-b"]);

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <ComposeDialog />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("ComposeDialog", () => {
  it("groups selected nodes with the entered compound label", async () => {
    const user = userEvent.setup();
    const store = renderDialog();

    expect(
      screen.getByText("2 selected nodes will move inside this compound."),
    ).toBeInTheDocument();

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "Review cluster");
    await user.click(screen.getByRole("button", { name: "Compose" }));

    const compound = store.getState().nodes.find((node) => node.type === "compound");
    expect(compound?.data.label).toBe("Review cluster");
    expect(store.getState().composingNodeIds).toBeNull();
  });
});
