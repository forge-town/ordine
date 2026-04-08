import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkRow } from "./WorkRow";
import type { WorkEntity } from "@/models/daos/worksDao";

const mockWork: WorkEntity = {
  id: "work-001",
  pipelineName: "CI Pipeline",
  status: "success",
  object: { type: "file", path: "/src/main.ts" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as unknown as WorkEntity;

describe("WorkRow", () => {
  it("renders pipeline name", () => {
    render(<WorkRow work={mockWork} />);
    expect(screen.getByText("CI Pipeline")).toBeInTheDocument();
  });

  it("renders success status label", () => {
    render(<WorkRow work={mockWork} />);
    expect(screen.getByText("成功")).toBeInTheDocument();
  });

  it("renders file path when not root", () => {
    render(<WorkRow work={mockWork} />);
    expect(screen.getByText("/src/main.ts")).toBeInTheDocument();
  });
});
