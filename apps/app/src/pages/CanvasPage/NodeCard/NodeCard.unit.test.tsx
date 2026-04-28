import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Box } from "lucide-react";
import { NodeCard } from "./NodeCard";

describe("NodeCard", () => {
  it("renders label", () => {
    render(<NodeCard icon={Box} label="Test Node" theme="emerald" />);
    expect(screen.getByText("Test Node")).toBeInTheDocument();
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
    // Card should only have header when no children
    expect(container.firstChild?.childNodes).toHaveLength(1);
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

    expect(container.firstChild).toHaveClass("w-72", "data-[size=sm]:py-0");
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
    expect(container.firstChild).toHaveClass("ring-emerald-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="violet" />);
    expect(container.firstChild).toHaveClass("ring-violet-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="amber" />);
    expect(container.firstChild).toHaveClass("ring-amber-500");

    rerender(<NodeCard selected icon={Box} label="Node" theme="sky" />);
    expect(container.firstChild).toHaveClass("ring-sky-500");
  });
});
