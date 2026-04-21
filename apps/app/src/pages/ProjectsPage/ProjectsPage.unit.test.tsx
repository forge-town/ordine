import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectsPage } from "./ProjectsPage";

vi.mock("./ProjectsPageContent/ProjectsPageContent", () => ({
  ProjectsPageContent: () => <div>ProjectsPageContent</div>,
}));

describe("ProjectsPage", () => {
  it("renders ProjectsPageContent", () => {
    render(<ProjectsPage />);
    expect(screen.getByText("ProjectsPageContent")).toBeTruthy();
  });
});
