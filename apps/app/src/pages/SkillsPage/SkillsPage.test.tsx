import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsPage } from "./SkillsPage";

vi.mock("@/routes/skills", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

describe("SkillsPage", () => {
  it("renders inside AppLayout", () => {
    render(<SkillsPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
