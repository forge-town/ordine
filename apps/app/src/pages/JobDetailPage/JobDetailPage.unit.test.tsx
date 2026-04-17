import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobDetailPage } from "./JobDetailPage";

vi.mock("@/routes/_layout/jobs.$jobId", () => ({
  Route: { useLoaderData: () => null, useParams: () => ({ jobId: "job-1" }) },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: { jobs: { getTraces: { query: vi.fn().mockResolvedValue([]) } } },
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

describe("JobDetailPage", () => {
  it("renders null state when no job", () => {
    render(<JobDetailPage />);
    expect(screen.getByText("不存在")).toBeInTheDocument();
  });
});
