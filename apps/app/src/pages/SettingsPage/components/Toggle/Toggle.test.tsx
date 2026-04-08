import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders label", () => {
    render(
      <Toggle
        enabled={false}
        label="Enable notifications"
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Enable notifications")).toBeTruthy();
  });

  it("renders in enabled state", () => {
    render(<Toggle enabled={true} label="Enable" onToggle={vi.fn()} />);
    expect(screen.getByText("Enable")).toBeTruthy();
  });
});
