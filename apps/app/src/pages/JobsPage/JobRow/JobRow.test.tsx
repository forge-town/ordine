import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobRow } from "./JobRow";
import type { JobRow as JobRowData } from "@repo/models";

const mockJob: JobRowData = {
  id: "job-001",
  title: "测试 Job",
  status: "running",
  type: "pipeline_run",
  projectId: "proj-001",
  pipelineId: null,
  logs: [],
  result: null,
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("JobRow", () => {
  it("renders job title and id", () => {
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(<JobRow job={mockJob} onClick={handleClick} onDelete={handleDelete} />);
    expect(screen.getByText("测试 Job")).toBeInTheDocument();
    expect(screen.getByText("job-001")).toBeInTheDocument();
  });

  it("calls onClick when row is clicked", () => {
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(<JobRow job={mockJob} onClick={handleClick} onDelete={handleDelete} />);
    fireEvent.click(screen.getByText("测试 Job"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", () => {
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(<JobRow job={mockJob} onClick={handleClick} onDelete={handleDelete} />);
    const deleteBtn = screen.getByRole("button");
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it("renders failed status label", () => {
    const handleClick = vi.fn();
    const handleDelete = vi.fn();
    render(
      <JobRow
        job={{ ...mockJob, status: "failed" }}
        onClick={handleClick}
        onDelete={handleDelete}
      />,
    );
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});
