import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RulesPage } from "./RulesPage";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => [],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("./RulesPageContent/RulesPageContent", () => ({
  RulesPageContent: () => <div>RulesPageContent</div>,
}));

describe("RulesPage", () => {
  it("renders RulesPageContent", () => {
    render(<RulesPage />);
    expect(screen.getByText("RulesPageContent")).toBeTruthy();
  });
});
