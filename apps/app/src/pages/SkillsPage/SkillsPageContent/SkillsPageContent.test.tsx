import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsPageContent } from "./SkillsPageContent";

vi.mock("@/routes/_layout/skills", () => ({
  Route: { useLoaderData: () => [] },
}));

describe("SkillsPageContent", () => {
  it("renders with empty skills", () => {
    render(<SkillsPageContent />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });
});
