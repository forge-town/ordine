import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import { DecisionNode } from "./DecisionNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "test",
  useUpdateNodeInternals: () => () => undefined,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CanvasPageStoreContext.Provider
    value={(() => {
      const store = createCanvasPageStore();
      store.setState({ nodeCardMode: "expanded" });

      return store;
    })()}
  >
    {children}
  </CanvasPageStoreContext.Provider>
);

const baseData = {
  nodeType: "decision" as const,
  label: "Human Review",
  selectMode: "single" as const,
  instruction: "Choose the best result",
};

describe("DecisionNode", () => {
  it("renders the label and decision fields", () => {
    render(<DecisionNode data={baseData} id="test" />, { wrapper });

    expect(screen.getByDisplayValue("Human Review")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Decision mode" })).toHaveValue("single");
    expect(screen.getByDisplayValue("Choose the best result")).toBeInTheDocument();
  });

  it("renders a multi-select decision", () => {
    render(<DecisionNode data={{ ...baseData, selectMode: "multi" }} id="test" />, { wrapper });

    expect(screen.getByRole("combobox", { name: "Decision mode" })).toHaveValue("multi");
    expect(screen.getAllByText("Multiple choice")).toHaveLength(2);
  });
});
