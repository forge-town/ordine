import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Annotation } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { AnnComposer } from "./AnnComposer";
import { AnnViewer } from "./AnnViewer";
import { CanvasAnnotationsContext, type UseAnnotationsResult } from "./useAnnotations";

const annotation = {
  author: "user",
  content: "Check the prompt contract",
  createdAt: new Date("2026-06-08T03:43:27.439Z"),
  id: "ann-1",
  pipelineId: "pipe-1",
  resolved: false,
  targetId: "node-a",
  targetType: "node",
  updatedAt: new Date("2026-06-08T03:43:27.439Z"),
} satisfies Annotation;

const makeAnnotationsContext = (
  overrides: Partial<UseAnnotationsResult> = {},
): UseAnnotationsResult => ({
  annotations: [annotation],
  annotationsByTargetId: new Map([["node-a", [annotation]]]),
  createAnnotation: vi.fn(async () => annotation),
  isCreating: false,
  isLoading: false,
  pipelineId: "pipe-1",
  ...overrides,
});

const renderWithAnnotations = (ui: React.ReactElement, context = makeAnnotationsContext()) =>
  render(
    <CanvasAnnotationsContext.Provider value={context}>{ui}</CanvasAnnotationsContext.Provider>,
  );

describe("annotations UI", () => {
  it("creates a node annotation from the composer", async () => {
    const user = userEvent.setup();
    const context = makeAnnotationsContext();
    const handleClose = vi.fn();

    renderWithAnnotations(
      <AnnComposer targetId="node-a" targetLabel="Parse" onClose={handleClose} />,
      context,
    );

    await user.type(screen.getByRole("textbox", { name: "Annotation content" }), "Review output");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    expect(context.createAnnotation).toHaveBeenCalledWith({
      content: "Review output",
      targetId: "node-a",
      targetType: "node",
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("shows annotations for the active target", () => {
    const handleAdd = vi.fn();
    const handleClose = vi.fn();

    renderWithAnnotations(
      <AnnViewer targetId="node-a" targetLabel="Parse" onAdd={handleAdd} onClose={handleClose} />,
    );

    expect(screen.getByText("Check the prompt contract")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});
