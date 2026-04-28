import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobRow } from "./JobRow";
import type { Job } from "@repo/schemas";

const mockNavigate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", () => ({
  useDelete: () => ({ mutate: mockDeleteMutate }),
}));

const mockJob: Job = {
  id: "job-001",
  title: "测试 Job",
  status: "running",
  type: "pipeline_run",
  parentJobId: null,
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("JobRow", () => {
  it("renders job title and id", () => {
    render(<JobRow job={mockJob} />);
    expect(screen.getByText("测试 Job")).toBeInTheDocument();
    expect(screen.getByText("job-001")).toBeInTheDocument();
  });

  it("navigates when row is clicked", () => {
    render(<JobRow job={mockJob} />);
    fireEvent.click(screen.getByText("测试 Job"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/jobs/$jobId",
      params: { jobId: "job-001" },
    });
  });

  it("calls delete when delete button is clicked", () => {
    render(<JobRow job={mockJob} />);
    const deleteBtn = screen.getByRole("button");
    fireEvent.click(deleteBtn);
    expect(mockDeleteMutate).toHaveBeenCalledWith({
      resource: "jobs",
      id: "job-001",
    });
  });

  it("renders failed status label", () => {
    render(<JobRow job={{ ...mockJob, status: "failed" }} />);
    expect(screen.getByText("失败")).toBeInTheDocument();
  });
});
