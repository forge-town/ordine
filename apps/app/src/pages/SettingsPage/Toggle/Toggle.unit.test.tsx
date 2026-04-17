import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toggle } from "./Toggle";

describe("Toggle", () => {
  it("renders label", () => {
    const handleToggle = vi.fn();
    render(<Toggle enabled={false} label="Enable notifications" onToggle={handleToggle} />);
    expect(screen.getByText("Enable notifications")).toBeTruthy();
  });

  it("renders in enabled state", () => {
    const handleToggle = vi.fn();
    render(<Toggle enabled={true} label="Enable" onToggle={handleToggle} />);
    expect(screen.getByText("Enable")).toBeTruthy();
  });
});
