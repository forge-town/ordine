import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Info } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders label", () => {
    render(<SectionHeader icon={Info} label="基本信息" />);
    expect(screen.getByText("基本信息")).toBeInTheDocument();
  });
});
