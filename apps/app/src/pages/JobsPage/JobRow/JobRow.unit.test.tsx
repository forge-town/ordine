import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { JobRow } from "./JobRow";
import type { Job } from "@repo/schemas";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

const mockJob: Job = {
  id: "job-001",
  title: "测试 Job",
  status: "running",
  type: "pipeline_run",
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  totalTokens: 12_400,
  totalCost: "0.42",
  nodeStatuses: { input: "done", agent: "running", output: "idle" },
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: null,
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("JobRow", () => {
  it("renders job title and id", () => {
    render(<JobRow job={mockJob} pipelineName="Research Pipeline" />);
    expect(screen.getByText("Research Pipeline")).toBeInTheDocument();
    expect(screen.getByText("job-001")).toBeInTheDocument();
    expect(screen.getByText("Step 2/3 · agent · running")).toBeInTheDocument();
  });

  it("navigates when row is clicked", () => {
    render(<JobRow job={mockJob} pipelineName="Research Pipeline" />);
    fireEvent.click(screen.getByText("Research Pipeline"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/pipelines/jobs/$jobId",
      params: { jobId: "job-001" },
    });
  });

  it("calls custom open handler when provided", () => {
    const handleOpen = vi.fn();
    render(<JobRow job={mockJob} pipelineName="Research Pipeline" onOpen={handleOpen} />);

    fireEvent.click(screen.getByRole("button"));

    expect(handleOpen).toHaveBeenCalledWith("job-001");
  });

  it("renders failed status label", () => {
    render(<JobRow job={{ ...mockJob, status: "failed" }} pipelineName="Research Pipeline" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
