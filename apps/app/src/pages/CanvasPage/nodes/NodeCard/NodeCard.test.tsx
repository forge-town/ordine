import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Box } from "lucide-react";
import { NodeCard } from "./NodeCard";

describe("NodeCard", () => {
  it("renders label", () => {
    render(<NodeCard theme="emerald" icon={Box} label="Test Node" />);
    expect(screen.getByText("Test Node")).toBeInTheDocument();
  });

  it("renders children in body", () => {
    render(
      <NodeCard theme="emerald" icon={Box} label="Node">
        <span>Body content</span>
      </NodeCard>
    );
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("does not render body wrapper when no children", () => {
    const { container } = render(<NodeCard theme="emerald" icon={Box} label="Node" />);
    // Card should only have header when no children
    expect(container.firstChild?.childNodes).toHaveLength(1);
  });

  it("renders headerRight slot", () => {
    render(<NodeCard theme="violet" icon={Box} label="Node" headerRight={<span>Status</span>} />);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("applies selected ring for each theme", () => {
    const { container, rerender } = render(
      <NodeCard theme="emerald" icon={Box} label="Node" selected />
    );
    expect(container.firstChild).toHaveClass("ring-emerald-500");

    rerender(<NodeCard theme="violet" icon={Box} label="Node" selected />);
    expect(container.firstChild).toHaveClass("ring-violet-500");

    rerender(<NodeCard theme="amber" icon={Box} label="Node" selected />);
    expect(container.firstChild).toHaveClass("ring-amber-500");

    rerender(<NodeCard theme="sky" icon={Box} label="Node" selected />);
    expect(container.firstChild).toHaveClass("ring-sky-500");
  });
});
