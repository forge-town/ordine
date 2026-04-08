import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsPageContent } from "./SkillsPageContent";

describe("SkillsPageContent", () => {
  it("renders with empty skills", () => {
    render(<SkillsPageContent skills={[]} />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });
});
