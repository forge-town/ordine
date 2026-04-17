import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPracticesPage } from "./BestPracticesPage";

vi.mock("@/routes/_layout/best-practices.index", () => ({
  Route: {
    useLoaderData: () => [],
  },
}));

vi.mock("@/services/bestPracticesService", () => ({
  deleteBestPractice: vi.fn(),
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

describe("BestPracticesPage", () => {
  it("renders empty state when no practices loaded", () => {
    render(<BestPracticesPage />);
    expect(screen.getByText("还没有任何最佳实践")).toBeInTheDocument();
  });
});
