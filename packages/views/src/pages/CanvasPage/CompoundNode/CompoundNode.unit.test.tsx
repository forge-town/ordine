import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompoundNode } from "./CompoundNode";

const mocks = vi.hoisted(() => ({
  hoveredCompoundId: null as string | null,
  updateNodeData: vi.fn(),
}));

vi.mock("@xyflow/react", () => ({
  Handle: ({
    className,
    id,
    position,
    style,
    type,
    "data-testid": _dataTestId,
    ...rest
  }: {
    className?: string;
    id?: string;
    position?: string;
    style?: React.CSSProperties;
    type?: string;
    [key: `data-${string}`]: string | undefined;
  }) => (
    <div
      className={className}
      data-handleid={id}
      data-offset={style?.["--node-port-offset" as keyof React.CSSProperties]}
      data-position={position}
      data-testid={`${type}-handle`}
      {...rest}
    />
  ),
  Position: { Left: "left", Right: "right" },
  useNodeId: vi.fn(() => "compound-1"),
  useUpdateNodeInternals: vi.fn(() => vi.fn()),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === "canvas.compoundNode.childCount") {
        return `${options?.count ?? 0} nodes`;
      }

      if (key === "canvas.nodeLabel") {
        return "Node label";
      }

      return key;
    },
  }),
}));

vi.mock("zustand", () => ({
  useStore: (_store: unknown, selector: (state: typeof mocks) => unknown) => selector(mocks),
}));

vi.mock("../_store", () => ({
  useCanvasPageStore: () => ({ mocked: true }),
}));

const data = {
  label: "Review Group",
  nodeType: "compound" as const,
  childNodeIds: ["source-file", "review-op"],
};

describe("CompoundNode", () => {
  beforeEach(() => {
    mocks.hoveredCompoundId = null;
    mocks.updateNodeData.mockReset();
  });

  it("keeps the variable-size parent shell and renders neutral header and ports", () => {
    const { container } = render(<CompoundNode data={data} id="compound-1" />);
    const root = screen.getByTestId("canvas-v2-node-shell-root");

    expect(root).toHaveClass("size-full", "min-h-30", "min-w-50", "bg-surface/80");
    expect(root).toHaveClass("shadow-soft", "ring-1", "ring-border");
    expect(screen.getByDisplayValue("Review Group")).toBeInTheDocument();
    expect(screen.getByText("2 nodes")).toBeInTheDocument();
    expect(screen.getByTestId("target-handle")).toHaveClass(
      "before:h-3",
      "before:w-3",
      "before:border-border-strong",
      "before:bg-surface",
    );
    expect(screen.getByTestId("source-handle")).toHaveClass(
      "before:h-3",
      "before:w-3",
      "before:border-border-strong",
      "before:bg-surface",
    );
    expect(container.querySelector(".border-indigo-500")).not.toBeInTheDocument();
    expect(container.querySelector(".bg-red-50")).not.toBeInTheDocument();
  });

  it("preserves editable labels and selected or hovered visual states", () => {
    const { rerender } = render(<CompoundNode data={data} id="compound-1" selected />);
    const root = screen.getByTestId("canvas-v2-node-shell-root");

    expect(root).toHaveClass("shadow-float", "ring-2", "ring-foreground/40");
    fireEvent.change(screen.getByRole("textbox", { name: "Node label" }), {
      target: { value: "Updated Group" },
    });
    expect(mocks.updateNodeData).toHaveBeenCalledWith("compound-1", { label: "Updated Group" });

    mocks.hoveredCompoundId = "compound-1";
    rerender(<CompoundNode data={data} id="compound-1" />);
    expect(root).toHaveClass("shadow-float", "ring-2", "ring-foreground/30");
  });
});
