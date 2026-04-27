import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { createStore } from "zustand";

vi.mock("@/lib/githubApi", () => ({
  parseGitHubUrl: vi.fn(),
  fetchRepoInfo: vi.fn(),
}));

vi.mock("@/hooks/useGithubToken", () => ({
  useGithubToken: () => ({ token: null }),
}));

vi.mock("@/pages/CanvasPage/GitHubProjectNode/GitHubTokenDialog", () => ({
  GitHubTokenDialog: () => <div data-testid="token-dialog" />,
}));

vi.mock("@/services/githubProjectsService", () => ({
  createGithubProject: vi.fn().mockResolvedValue({}),
}));

vi.mock("../_store", () => ({
  useProjectsPageStore: () =>
    createStore(() => ({
      search: "",
      showCreate: true,
      handleSetSearch: vi.fn(),
      handleSetShowCreate: vi.fn(),
    })),
}));

describe("CreateProjectDialog", () => {
  it("renders dialog title", () => {
    render(<CreateProjectDialog />);
    expect(screen.getByText("连接 GitHub 项目")).toBeInTheDocument();
  });

  it("renders URL input", () => {
    render(<CreateProjectDialog />);
    expect(screen.getByPlaceholderText("https://github.com/owner/repo")).toBeInTheDocument();
  });
});
