import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "./ProjectCard";
import type { GithubProjectEntity } from "@repo/models";

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
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(<ProjectCard project={mockProject} onClick={handleClick} onDelete={handleDelete} />);
    expect(screen.getByText("acme/ordine")).toBeInTheDocument();
  });

  it("renders branch", () => {
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(<ProjectCard project={mockProject} onClick={handleClick} onDelete={handleDelete} />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });
});
