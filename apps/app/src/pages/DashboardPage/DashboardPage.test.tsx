import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

vi.mock("@/routes/index", () => ({
  Route: {
    useLoaderData: () => ({ pipelines: [], projects: [], jobs: [] }),
  },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => <a>{children}</a>,
}));

describe("DashboardPage", () => {
  it("renders inside AppLayout", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders dashboard header", () => {
    render(<DashboardPage />);
    expect(screen.getByText("仪表盘")).toBeInTheDocument();
  });
});
