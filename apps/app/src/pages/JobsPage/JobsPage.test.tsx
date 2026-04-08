import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobsPage } from "./JobsPage";

vi.mock("@/routes/jobs.index", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/jobsService", () => ({
  deleteJob: vi.fn().mockResolvedValue(undefined),
}));

describe("JobsPage", () => {
  it("renders inside AppLayout", () => {
    render(<JobsPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders Jobs 监控 header", () => {
    render(<JobsPage />);
    expect(screen.getByText("Jobs 监控")).toBeInTheDocument();
  });
});
