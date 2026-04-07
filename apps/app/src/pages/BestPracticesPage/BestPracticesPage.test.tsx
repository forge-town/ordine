import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPracticesPage } from "./BestPracticesPage";

vi.mock("@/routes/best-practices", () => ({
  Route: {
    useLoaderData: () => [],
  },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/services/bestPracticesService", () => ({
  deleteBestPractice: vi.fn(),
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

describe("BestPracticesPage", () => {
  it("renders inside AppLayout", () => {
    render(<BestPracticesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders empty state when no practices loaded", () => {
    render(<BestPracticesPage />);
    expect(screen.getByText("还没有最佳实践")).toBeInTheDocument();
  });
});
