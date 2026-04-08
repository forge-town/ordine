import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobRow } from "./JobRow";
import type { JobEntity } from "@/models/daos/jobsDao";

const mockJob: JobEntity = {
  id: "job-001",
  title: "测试 Job",
  status: "running",
  type: "pipeline_run",
  projectId: "proj-001",
  startedAt: Date.now() - 5000,
  finishedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("JobRow", () => {
  it("renders job title and id", () => {
    render(<JobRow job={mockJob} onClick={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("测试 Job")).toBeInTheDocument();
    expect(screen.getByText("job-001")).toBeInTheDocument();
  });

  it("calls onClick when row is clicked", () => {
    const handleClick = vi.fn();
    render(<JobRow job={mockJob} onClick={handleClick} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText("测试 Job"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", () => {
    const handleDelete = vi.fn();
    render(<JobRow job={mockJob} onClick={vi.fn()} onDelete={handleDelete} />);
    const deleteBtn = screen.getByRole("button");
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it("renders failed status label", () => {
    render(
      <JobRow
        job={{ ...mockJob, status: "failed" }}
        onClick={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});
