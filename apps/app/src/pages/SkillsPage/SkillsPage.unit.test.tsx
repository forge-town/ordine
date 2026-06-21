import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { SkillsPage } from "./SkillsPage";

vi.mock("./SkillsPageContent", () => ({
  SkillsPageContent: () => <div>Skills content</div>,
}));

vi.mock("@/components/SkillToOperationDialog", () => ({
  SkillToOperationDialog: () => null,
}));

describe("SkillsPage", () => {
  it("renders without crashing", () => {
    render(<SkillsPage />);
    expect(screen.getByText("Skills content")).toBeInTheDocument();
  });
});
