import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DecisionBoardView } from "./DecisionBoardView";
import type { DecisionCandidate } from "./DecisionCandidateCard";

const candidates: DecisionCandidate[] = [
  { nodeId: "a", label: "Variant A", content: "# A" },
  { nodeId: "b", label: "Variant B", content: "# B" },
];

const renderBoard = (props: Partial<Parameters<typeof DecisionBoardView>[0]> = {}) => {
  const onToggle = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DecisionBoardView
      nodeLabel="Pick one"
      selectMode="single"
      candidates={candidates}
      selectedIds={[]}
      submitting={false}
      onToggle={onToggle}
      onConfirm={onConfirm}
      {...props}
    />,
  );

  return { onToggle, onConfirm };
};

describe("DecisionBoardView", () => {
  it("renders one card per candidate", () => {
    renderBoard();
    expect(screen.getByTestId("decision-board")).toBeInTheDocument();
    expect(screen.getByTestId("decision-candidate-0")).toBeInTheDocument();
    expect(screen.getByTestId("decision-candidate-1")).toBeInTheDocument();
  });

  it("disables confirm until something is selected (no default selection)", () => {
    renderBoard({ selectedIds: [] });
    expect(screen.getByTestId("decision-confirm")).toBeDisabled();
  });

  it("enables confirm once a candidate is selected", () => {
    renderBoard({ selectedIds: ["a"] });
    expect(screen.getByTestId("decision-confirm")).toBeEnabled();
  });

  it("keeps confirm disabled while submitting", () => {
    renderBoard({ selectedIds: ["a"], submitting: true });
    expect(screen.getByTestId("decision-confirm")).toBeDisabled();
  });

  it("emits the candidate id on toggle", async () => {
    const { onToggle } = renderBoard();
    await userEvent.click(screen.getByTestId("decision-candidate-select-1"));
    expect(onToggle).toHaveBeenCalledWith("b");
  });
});
