import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

const { MockChart } = vi.hoisted(() => ({
  MockChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/routes/_layout/index", () => ({
  Route: {
    useLoaderData: () => ({ pipelines: [], projects: [], jobs: [] }),
  },
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

vi.mock("recharts", () => {
  return {
    ResponsiveContainer: MockChart,
    AreaChart: MockChart,
    Area: MockChart,
    CartesianGrid: MockChart,
    Tooltip: MockChart,
    XAxis: MockChart,
    YAxis: MockChart,
    BarChart: MockChart,
    Bar: MockChart,
    Cell: MockChart,
  };
});

describe("DashboardPage", () => {
  it("renders dashboard header", () => {
    render(<DashboardPage />);
    expect(screen.getByText("仪表盘")).toBeInTheDocument();
  });
});
