import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineDetailPage } from "./PipelineDetailPage";

vi.mock("@/routes/_layout/pipelines.$pipelineId", () => ({
  Route: { useLoaderData: () => ({ pipeline: null, operations: [] }) },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("PipelineDetailPage", () => {
  it("shows not found message when pipeline is null", () => {
    render(<PipelineDetailPage />);
    expect(screen.getByText("Pipeline 不存在")).toBeInTheDocument();
  });
});
