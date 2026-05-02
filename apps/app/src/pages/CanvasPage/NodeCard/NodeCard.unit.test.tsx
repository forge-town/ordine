import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Box } from "lucide-react";
import { NodeCard } from "./NodeCard";

const xyflowMocks = vi.hoisted(() => {
  const updateNodeInternals = vi.fn();

  return {
    updateNodeInternals,
    useNodeId: vi.fn(() => "node-id"),
    useUpdateNodeInternals: vi.fn(() => updateNodeInternals),
  };
});

vi.mock("@xyflow/react", () => ({
  Handle: ({
    className,
    id,
    position,
    style,
    type,
  }: {
    className?: string;
    id?: string;
    position?: string;
    style?: React.CSSProperties;
    type?: string;
  }) => (
    <div
      className={className}
      data-handleid={id}
      data-offset={style?.["--node-port-offset" as keyof React.CSSProperties]}
      data-position={position}
      data-testid={`${type}-handle`}
    />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  useNodeId: xyflowMocks.useNodeId,
  useUpdateNodeInternals: xyflowMocks.useUpdateNodeInternals,
}));

describe("NodeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders label", () => {
    render(<NodeCard icon={Box} label="Test Node" theme="emerald" />);
    expect(screen.getByText("Test Node")).toBeInTheDocument();
  });

  it("does not call React Flow hooks when ports are disabled", () => {
    render(<NodeCard icon={Box} label="Standalone Node" theme="emerald" />);

    expect(xyflowMocks.useNodeId).not.toHaveBeenCalled();
    expect(xyflowMocks.useUpdateNodeInternals).not.toHaveBeenCalled();
  });

  it("renders children in body", () => {
    render(
      <NodeCard icon={Box} label="Node" theme="emerald">
        <span>Body content</span>
      </NodeCard>
    );
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("does not render body wrapper when no children", () => {
    const { container } = render(<NodeCard icon={Box} label="Node" theme="emerald" />);
    const wrapper = container.firstElementChild;
    const card = wrapper?.firstElementChild;

    expect(wrapper).toHaveClass("relative");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card?.childNodes).toHaveLength(1);
  });

  it("renders headerRight slot", () => {
    render(<NodeCard headerRight={<span>Status</span>} icon={Box} label="Node" theme="violet" />);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("keeps header affordances visible for long labels", () => {
    const { container } = render(
      <NodeCard
        description="Long description should remain readable without destroying layout"
        headerRight={<span>Status</span>}
        icon={Box}
        label="Very Long Node Name That Should Not Break The Card Layout"
        theme="violet"
      />
    );

    expect(container.firstElementChild).toHaveClass("relative");
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "w-72",
      "data-[size=sm]:py-0"
    );
    expect(container.querySelector('[data-slot="card-header"] > div')).toHaveClass(
      "w-full",
      "min-w-0"
    );
    expect(container.querySelector('[data-slot="card-header"]')).toHaveClass(
      "min-h-14",
      "rounded-none"
    );
    expect(container.querySelector('[data-slot="card-action"]')).toHaveClass(
      "shrink-0",
      "self-center"
    );
  });

  it("applies selected ring for each theme", () => {
    const { container, rerender } = render(
      <NodeCard selected icon={Box} label="Node" theme="emerald" />
    );
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-emerald-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="violet" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-violet-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="amber" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-amber-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="sky" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-sky-500");
  });

  it("renders one small center port per enabled side by default", () => {
    render(<NodeCard leftHandle rightHandle icon={Box} label="Node" theme="orange" />);

    expect(screen.getByTestId("target-handle")).toHaveClass(
      "!left-2.5",
      "!h-5",
      "!w-5",
      "!bg-transparent",
      "before:!left-0",
      "before:!bg-orange-500"
    );
    expect(screen.getByTestId("source-handle")).toHaveClass(
      "!right-2.5",
      "!h-5",
      "!w-5",
      "!bg-transparent",
      "before:!left-full",
      "before:!bg-orange-500"
    );
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-handleid", "left-port-0");
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-offset", "0px");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-handleid", "right-port-0");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-offset", "0px");
  });

  it("splits ports into multiple vertical slots", () => {
    render(
      <NodeCard
        leftHandle
        rightHandle
        icon={Box}
        label="Node"
        leftHandleCount={2}
        rightHandleCount={3}
        theme="violet"
      />
    );

    const targetHandles = screen.getAllByTestId("target-handle");
    const sourceHandles = screen.getAllByTestId("source-handle");

    expect(targetHandles).toHaveLength(2);
    expect(sourceHandles).toHaveLength(3);
    expect(targetHandles.map((handle) => handle.dataset.handleid)).toEqual([
      "left-port-0",
      "left-port-1",
    ]);
    expect(targetHandles.map((handle) => handle.dataset.offset)).toEqual(["-28px", "28px"]);
    expect(sourceHandles.map((handle) => handle.dataset.handleid)).toEqual([
      "right-port-0",
      "right-port-1",
      "right-port-2",
    ]);
    expect(sourceHandles.map((handle) => handle.dataset.offset)).toEqual(["-36px", "0px", "36px"]);
  });

  it("keeps editable label read-only until clicked", () => {
    const handleLabelChange = vi.fn();
    render(
      <NodeCard
        icon={Box}
        label="Editable Node"
        theme="emerald"
        onLabelChange={handleLabelChange}
      />
    );

    const input = screen.getByLabelText("Node label");
    expect(input).toHaveAttribute("readonly");

    fireEvent.click(input);
    expect(input).not.toHaveAttribute("readonly");

    fireEvent.blur(input);
    expect(input).toHaveAttribute("readonly");
  });

  it("enables editable label when focused by keyboard", () => {
    const handleLabelChange = vi.fn();
    render(
      <NodeCard
        icon={Box}
        label="Keyboard Editable Node"
        theme="emerald"
        onLabelChange={handleLabelChange}
      />
    );

    const input = screen.getByLabelText("Node label");
    expect(input).toHaveAttribute("readonly");

    fireEvent.focus(input);
    expect(input).not.toHaveAttribute("readonly");
  });
});
