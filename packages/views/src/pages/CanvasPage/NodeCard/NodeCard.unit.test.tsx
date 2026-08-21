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
      </NodeCard>,
    );
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("hides card body when compact", () => {
    const { container } = render(
      <NodeCard compact icon={Box} label="Node" theme="emerald">
        <span>Body content</span>
      </NodeCard>,
    );

    expect(screen.queryByText("Body content")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-card-mode", "compact");
  });

  it("does not render body wrapper when no children", () => {
    const { container } = render(<NodeCard icon={Box} label="Node" theme="emerald" />);
    const wrapper = container.firstElementChild;
    const card = container.querySelector('[data-slot="card"]');

    expect(wrapper).toHaveClass("relative", "w-[214px]");
    expect(card).toHaveAttribute("data-slot", "card");
    expect(card?.childNodes).toHaveLength(1);
  });

  it("renders headerRight slot", () => {
    render(<NodeCard headerRight={<span>Status</span>} icon={Box} label="Node" theme="violet" />);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("uses Alan's status dot and running indicator", () => {
    const { container, rerender } = render(
      <NodeCard
        detail="Executing"
        icon={Box}
        label="Running node"
        runStatus="running"
        theme="violet"
      >
        <span>Body content</span>
      </NodeCard>,
    );

    const statusDot = container.querySelector(
      '[data-testid="canvas-v2-node-shell-root"] > span[aria-label]',
    );
    expect(statusDot).toHaveClass("inline-flex", "h-[9px]", "w-[9px]");
    expect(statusDot?.querySelector(".bg-foreground")).toBeInTheDocument();
    expect(statusDot?.querySelector(".animate-ping")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card-content"]')).toHaveTextContent("Executing");
    expect(container.querySelector('[data-slot="card-content"]')).toHaveTextContent(
      /执行中|running/i,
    );

    rerender(
      <NodeCard detail="Complete" icon={Box} label="Done node" runStatus="done" theme="violet" />,
    );
    expect(
      container.querySelector(
        '[data-testid="canvas-v2-node-shell-root"] > span[aria-label] .bg-success',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector(
        '[data-testid="canvas-v2-node-shell-root"] > span[aria-label] .animate-ping',
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps header affordances visible for long labels", () => {
    const { container } = render(
      <NodeCard
        description="Long description should remain readable without destroying layout"
        headerRight={<span>Status</span>}
        icon={Box}
        label="Very Long Node Name That Should Not Break The Card Layout"
        theme="violet"
      />,
    );

    expect(container.firstElementChild).toHaveClass("relative", "w-[214px]");
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "relative",
      "overflow-hidden",
      "rounded-xl",
      "bg-surface",
      "ring-1",
      "ring-border",
    );
    expect(container.querySelector('[data-slot="card-header"]')).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "border-b",
      "border-border/70",
    );
    expect(container.querySelector('[data-slot="card-description"]')).toHaveClass(
      "truncate",
      "text-[10px]",
      "text-muted-foreground",
    );
    expect(container.querySelector('[data-slot="card-action"]')).toHaveClass("shrink-0");
  });

  it("applies the neutral Alan selection ring for every theme", () => {
    const { container, rerender } = render(
      <NodeCard selected icon={Box} label="Node" theme="emerald" />,
    );
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-foreground/40");

    rerender(<NodeCard selected icon={Box} label="Node" theme="violet" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-foreground/40");

    rerender(<NodeCard selected icon={Box} label="Node" theme="amber" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-foreground/40");

    rerender(<NodeCard selected icon={Box} label="Node" theme="sky" />);
    expect(container.querySelector('[data-slot="card"]')).toHaveClass("ring-foreground/40");
  });

  it("uses Alan hover-only action pill visibility", () => {
    const handleAsk = vi.fn();
    const handleConfigure = vi.fn();
    const handleDelete = vi.fn();
    const handleDuplicate = vi.fn();
    render(
      <NodeCard
        selected
        actions={{
          onAsk: handleAsk,
          onConfigure: handleConfigure,
          onDelete: handleDelete,
          onDuplicate: handleDuplicate,
        }}
        icon={Box}
        label="Node"
        theme="violet"
      />,
    );

    expect(screen.getByTestId("canvas-node-actions")).toHaveClass(
      "hidden",
      "group-hover/node-card:flex",
      "rounded-full",
    );
    fireEvent.click(screen.getByTestId("canvas-node-configure"));
    fireEvent.click(screen.getByTestId("canvas-node-ask"));
    fireEvent.click(screen.getByTestId("canvas-node-duplicate"));
    fireEvent.click(screen.getByTestId("canvas-node-delete"));
    expect(handleConfigure).toHaveBeenCalled();
    expect(handleAsk).toHaveBeenCalled();
    expect(handleDuplicate).toHaveBeenCalled();
    expect(handleDelete).toHaveBeenCalled();
  });

  it("renders one small center port per enabled side by default", () => {
    render(<NodeCard leftHandle rightHandle icon={Box} label="Node" theme="orange" />);

    expect(screen.getByTestId("target-handle")).toHaveClass(
      "!left-0",
      "!h-0",
      "!min-h-0",
      "!w-0",
      "!min-w-0",
      "!bg-transparent",
      "before:left-1/2",
      "after:h-5",
      "after:w-5",
      "before:h-3",
      "before:w-3",
      "before:border-border-strong",
      "before:bg-surface",
      "hover:before:scale-150",
    );
    expect(screen.getByTestId("source-handle")).toHaveClass(
      "!right-0",
      "!h-0",
      "!min-h-0",
      "!w-0",
      "!min-w-0",
      "!bg-transparent",
      "before:left-1/2",
      "after:h-5",
      "after:w-5",
      "before:h-3",
      "before:w-3",
      "before:border-border-strong",
      "before:bg-surface",
      "hover:before:scale-150",
    );
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-handleid", "left-port-0");
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-port-state", "idle");
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-connected", "false");
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("target-handle")).toHaveAttribute("data-offset", "0px");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-handleid", "right-port-0");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-port-state", "idle");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-connected", "false");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-active", "false");
    expect(screen.getByTestId("source-handle")).toHaveAttribute("data-offset", "0px");
  });

  it("marks connected and active ports for stronger visual states", () => {
    render(
      <NodeCard
        leftHandle
        rightHandle
        icon={Box}
        label="Node"
        leftActivePortCount={1}
        leftActivePortMask={1}
        leftConnectedPortCount={1}
        leftConnectedPortMask={2}
        leftHandleCount={2}
        rightConnectedPortCount={1}
        rightConnectedPortMask={1}
        theme="teal"
      />,
    );

    const targetHandles = screen.getAllByTestId("target-handle");
    const sourceHandle = screen.getByTestId("source-handle");

    expect(targetHandles[0]).toHaveAttribute("data-port-state", "active");
    expect(targetHandles[0]).toHaveAttribute("data-active", "true");
    expect(targetHandles[1]).toHaveAttribute("data-port-state", "connected");
    expect(targetHandles[1]).toHaveAttribute("data-connected", "true");
    expect(sourceHandle).toHaveAttribute("data-port-state", "connected");
    expect(sourceHandle).toHaveClass("data-[connected=true]:before:border-foreground/60");
    expect(targetHandles[0]).toHaveClass(
      "data-[active=true]:before:scale-125",
      "data-[active=true]:before:border-foreground",
    );
  });

  it("keeps fallback visual masks deterministic above the safe mask range", () => {
    render(
      <NodeCard
        rightHandle
        icon={Box}
        label="Node"
        rightActivePortCount={1}
        rightConnectedPortCount={53}
        rightHandleCount={54}
        theme="teal"
      />,
    );

    const sourceHandles = screen.getAllByTestId("source-handle");

    expect(sourceHandles[52]).toHaveAttribute("data-port-state", "connected");
    expect(sourceHandles[53]).toHaveAttribute("data-port-state", "idle");
    expect(sourceHandles[53]).toHaveAttribute("data-active", "false");
    expect(sourceHandles[53]).toHaveAttribute("data-connected", "false");
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
      />,
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
      />,
    );

    const input = screen.getByLabelText(/Node label|节点标签/);
    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveClass("cursor-inherit");
    expect(input).not.toHaveClass("cursor-default");

    fireEvent.click(input);
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveClass("select-text");

    fireEvent.blur(input);
    expect(input).toHaveAttribute("readonly");
  });

  it("sizes editable label input to the title text instead of the header row", () => {
    const handleLabelChange = vi.fn();
    render(
      <NodeCard
        icon={Box}
        label="Editable Node"
        theme="emerald"
        onLabelChange={handleLabelChange}
      />,
    );

    const input = screen.getByLabelText(/Node label|节点标签/);
    const labelSizer = input.parentElement;
    const mirrorLabel = labelSizer?.firstElementChild;

    expect(labelSizer).toHaveClass("relative", "inline-block", "max-w-full", "overflow-hidden");
    expect(mirrorLabel).toHaveClass("invisible", "block", "truncate", "whitespace-pre");
    expect(input).toHaveClass("absolute", "inset-0", "w-full", "max-w-full", "truncate", "p-0");
    expect(input).not.toHaveClass("w-auto");
  });

  it("enables editable label when focused by keyboard", () => {
    const handleLabelChange = vi.fn();
    render(
      <NodeCard
        icon={Box}
        label="Keyboard Editable Node"
        theme="emerald"
        onLabelChange={handleLabelChange}
      />,
    );

    const input = screen.getByLabelText(/Node label|节点标签/);
    expect(input).toHaveAttribute("readonly");

    fireEvent.focus(input);
    expect(input).not.toHaveAttribute("readonly");
  });
});
