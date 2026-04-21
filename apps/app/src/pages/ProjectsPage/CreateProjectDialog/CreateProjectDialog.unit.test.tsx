import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { CreateProjectDialog } from "./CreateProjectDialog";

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

describe("CreateProjectDialog", () => {
  it("renders dialog title", () => {
    const handleClose = vi.fn();
    const handleCreate = vi.fn();
    render(<CreateProjectDialog onClose={handleClose} onCreate={handleCreate} />);
    expect(screen.getByText("连接 GitHub 项目")).toBeInTheDocument();
  });

  it("renders URL input", () => {
    const handleClose = vi.fn();
    const handleCreate = vi.fn();
    render(<CreateProjectDialog onClose={handleClose} onCreate={handleCreate} />);
    expect(screen.getByPlaceholderText("https://github.com/owner/repo")).toBeInTheDocument();
  });
});
