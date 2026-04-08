import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineDetailPage } from "./PipelineDetailPage";

vi.mock("@/routes/pipelines.$pipelineId", () => ({
  Route: { useLoaderData: () => ({ pipeline: null, operations: [] }) },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

describe("PipelineDetailPage", () => {
  it("renders inside AppLayout", () => {
    render(<PipelineDetailPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows not found message when pipeline is null", () => {
    render(<PipelineDetailPage />);
    expect(screen.getByText("Pipeline 不存在")).toBeInTheDocument();
  });
});
