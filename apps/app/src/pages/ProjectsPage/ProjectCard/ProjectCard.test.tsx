import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";

const mockProject = {
  id: "proj-001",
  name: "acme/ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "项目描述",
  githubUrl: "https://github.com/acme/ordine",
  isPrivate: false,
  updatedAt: Date.now(),
  createdAt: Date.now(),
} as unknown as GithubProjectEntity;

describe("ProjectCard", () => {
  it("renders owner/repo", () => {
    render(
      <ProjectCard
        project={mockProject}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("acme/ordine")).toBeInTheDocument();
  });

  it("renders branch", () => {
    render(
      <ProjectCard
        project={mockProject}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("main")).toBeInTheDocument();
  });
});
