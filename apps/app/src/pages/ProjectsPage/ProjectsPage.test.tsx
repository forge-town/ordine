import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectsPage } from "./ProjectsPage";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("./ProjectsPageContent/ProjectsPageContent", () => ({
  ProjectsPageContent: () => <div>ProjectsPageContent</div>,
}));

describe("ProjectsPage", () => {
  it("renders ProjectsPageContent inside AppLayout", () => {
    render(<ProjectsPage />);
    expect(screen.getByText("ProjectsPageContent")).toBeTruthy();
  });
});
