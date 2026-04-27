import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import type { GithubProject } from "@repo/schemas";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useDelete: () => ({ mutate: vi.fn() }),
}));

const mockProject = {
  id: "proj-001",
  name: "acme/ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "项目描述",
  githubUrl: "https://github.com/acme/ordine",
  isPrivate: false,
  meta: { createdAt: new Date(), updatedAt: new Date() },
} as unknown as GithubProject;

describe("ProjectCard", () => {
  it("renders owner/repo", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("acme/ordine")).toBeInTheDocument();
  });

  it("renders branch", () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });
});
