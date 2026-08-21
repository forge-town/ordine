import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorNode } from "./ErrorNode";

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
  useNodeId: vi.fn(() => "unknown-node"),
  useUpdateNodeInternals: vi.fn(() => vi.fn()),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      if (key === "canvas.unknownNode") {
        return "Unknown node";
      }

      if (key === "workspace.canvas.nodes.status.failed") {
        return "Failed";
      }

      return options?.defaultValue ?? key;
    },
  }),
}));

describe("ErrorNode", () => {
  it("uses neutral card grammar with failed status and both connectivity ports", () => {
    const { container } = render(
      <ErrorNode data={{}} id="unknown-node" selected type="legacy-node" />,
    );

    expect(screen.getByText("Unknown node")).toBeInTheDocument();
    expect(screen.getByText("type: legacy-node | id: unknown-node")).toBeInTheDocument();
    expect(screen.getByTitle("Failed")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "bg-surface",
      "shadow-float",
      "ring-2",
      "ring-foreground/40",
    );
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
    expect(container.querySelector(".bg-red-50")).not.toBeInTheDocument();
  });

  it("keeps undefined type visible in fallback detail", () => {
    render(<ErrorNode data={{}} id="missing-type" />);

    expect(screen.getByText("type: undefined | id: missing-type")).toBeInTheDocument();
  });
});
