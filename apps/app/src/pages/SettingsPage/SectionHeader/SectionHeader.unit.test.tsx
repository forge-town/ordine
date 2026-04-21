import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders title", () => {
    render(<SectionHeader description="desc" title="My Title" />);
    expect(screen.getByText("My Title")).toBeTruthy();
  });

  it("renders description", () => {
    render(<SectionHeader description="My description" title="Title" />);
    expect(screen.getByText("My description")).toBeTruthy();
  });
});
