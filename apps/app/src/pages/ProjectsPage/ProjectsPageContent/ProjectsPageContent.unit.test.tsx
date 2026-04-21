import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { ProjectsPageContent } from "./ProjectsPageContent";

vi.mock("@/routes/_layout/projects.index", () => ({
  Route: {
    useLoaderData: () => [],
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/githubProjectsService", () => ({
  deleteGithubProject: vi.fn(),
  createGithubProject: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    query: { isLoading: false },
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
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

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useProjectsPageStore: () =>
    createStore(() => ({
      search: "",
      showCreate: false,
      handleSetSearch: vi.fn(),
      handleSetShowCreate: vi.fn(),
    })),
}));

describe("ProjectsPageContent", () => {
  it("renders empty state when no projects", () => {
    render(<ProjectsPageContent />);
    expect(screen.getByText("还没有关联任何 GitHub 项目")).toBeTruthy();
  });

  it("renders header with title", () => {
    render(<ProjectsPageContent />);
    expect(screen.getByText("GitHub 项目")).toBeTruthy();
  });

  it("renders connect button", () => {
    render(<ProjectsPageContent />);
    expect(screen.getAllByText(/导入项目/).length).toBeGreaterThan(0);
  });
});
