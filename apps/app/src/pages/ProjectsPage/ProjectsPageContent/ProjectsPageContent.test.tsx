import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectsPageContent } from "./ProjectsPageContent";

vi.mock("@/routes/projects.index", () => ({
  Route: {
    useLoaderData: () => [],
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/githubProjectsService", () => ({
  deleteGithubProject: vi.fn(),
  createGithubProject: vi.fn(),
}));

vi.mock("../CreateProjectDialog", () => ({
  CreateProjectDialog: () => <div>CreateProjectDialog</div>,
}));

vi.mock("../ProjectCard", () => ({
  ProjectCard: ({ project }: { project: { owner: string; repo: string } }) => (
    <div>
      {project.owner}/{project.repo}
    </div>
  ),
}));

describe("ProjectsPageContent", () => {
  it("renders empty state when no projects", () => {
    render(<ProjectsPageContent />);
    expect(screen.getByText("还没有项目")).toBeTruthy();
  });

  it("renders header with title", () => {
    render(<ProjectsPageContent />);
    expect(screen.getByText("项目")).toBeTruthy();
  });

  it("renders connect button", () => {
    render(<ProjectsPageContent />);
    expect(screen.getAllByText("连接 GitHub 项目").length).toBeGreaterThan(0);
  });
});
