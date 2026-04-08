import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPracticesPage } from "./BestPracticesPage";

vi.mock("@/routes/_layout/best-practices", () => ({
  Route: {
    useLoaderData: () => [],
  },
}));

vi.mock("@/services/bestPracticesService", () => ({
  deleteBestPractice: vi.fn(),
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

describe("BestPracticesPage", () => {
  it("renders empty state when no practices loaded", () => {
    render(<BestPracticesPage />);
    expect(screen.getByText("还没有最佳实践")).toBeInTheDocument();
  });
});
