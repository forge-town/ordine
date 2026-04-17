import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetaRow } from "./MetaRow";

describe("MetaRow", () => {
  it("renders label and value", () => {
    render(<MetaRow label="类型" value="Pipeline 执行" />);
    expect(screen.getByText("类型")).toBeInTheDocument();
    expect(screen.getByText("Pipeline 执行")).toBeInTheDocument();
  });

  it("returns null when value is empty", () => {
    const { container } = render(<MetaRow label="类型" value={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies mono class when mono is true", () => {
    render(<MetaRow mono label="ID" value="abc-123" />);
    const valueEl = screen.getByText("abc-123");
    expect(valueEl.className).toContain("font-mono");
  });
});
