import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPage } from "./JobDetailPage";

vi.mock("@/routes/jobs.$jobId", () => ({
  Route: { useLoaderData: () => null },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("JobDetailPage", () => {
  it("renders inside AppLayout", () => {
    render(<JobDetailPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders null state when no job", () => {
    render(<JobDetailPage />);
    expect(screen.getByText("Job 不存在")).toBeInTheDocument();
  });
});
