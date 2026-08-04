import { describe, expect, it } from "vitest";
import { createCanvasStore } from "./canvasStore";

describe("decisionSlice", () => {
  it("starts with no selection (no fabricated default)", () => {
    const store = createCanvasStore();
    expect(store.getState().decisionSelections).toEqual({});
  });

  it("single mode keeps at most one candidate and toggles off on re-pick", () => {
    const store = createCanvasStore();
    const { toggleDecisionCandidate } = store.getState();

    toggleDecisionCandidate("d1", "a", "single");
    expect(store.getState().decisionSelections.d1).toEqual(["a"]);

    toggleDecisionCandidate("d1", "b", "single");
    expect(store.getState().decisionSelections.d1).toEqual(["b"]);

    toggleDecisionCandidate("d1", "b", "single");
    expect(store.getState().decisionSelections.d1).toEqual([]);
  });

  it("multi mode accumulates and removes candidates", () => {
    const store = createCanvasStore();
    const { toggleDecisionCandidate } = store.getState();

    toggleDecisionCandidate("d1", "a", "multi");
    toggleDecisionCandidate("d1", "b", "multi");
    expect(store.getState().decisionSelections.d1).toEqual(["a", "b"]);

    toggleDecisionCandidate("d1", "a", "multi");
    expect(store.getState().decisionSelections.d1).toEqual(["b"]);
  });

  it("clears a decision's selection without touching others", () => {
    const store = createCanvasStore();
    const { toggleDecisionCandidate, clearDecisionSelection } = store.getState();

    toggleDecisionCandidate("d1", "a", "multi");
    toggleDecisionCandidate("d2", "x", "multi");
    clearDecisionSelection("d1");

    expect(store.getState().decisionSelections.d1).toBeUndefined();
    expect(store.getState().decisionSelections.d2).toEqual(["x"]);
  });
});
