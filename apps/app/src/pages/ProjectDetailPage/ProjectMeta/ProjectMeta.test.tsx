import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectMeta } from "./ProjectMeta";
import type { GithubProjectRow } from "@repo/models";

const mockProject = {
  id: "proj-001",
  name: "ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "项目描述",
  githubUrl: "https://github.com/acme/ordine",
} as unknown as GithubProjectRow;

describe("ProjectMeta", () => {
  it("renders owner/repo", () => {
    render(<ProjectMeta project={mockProject} />);
    expect(screen.getByText("acme/ordine")).toBeInTheDocument();
  });

  it("renders branch", () => {
    render(<ProjectMeta project={mockProject} />);
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<ProjectMeta project={mockProject} />);
    expect(screen.getByText("项目描述")).toBeInTheDocument();
  });
});
