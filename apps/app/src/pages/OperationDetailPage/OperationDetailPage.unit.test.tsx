import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { OperationDetailPage } from "./OperationDetailPage";

vi.mock("@/routes/_layout/operations.$operationId.index", () => ({
  Route: { useLoaderData: () => null, useParams: () => ({ operationId: "op-1" }) },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  createFileRoute: () => () => ({ useLoaderData: () => null }),
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: vi.fn().mockResolvedValue({}),
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

describe("OperationDetailPage", () => {
  it("shows 不存在 message when operation is null", () => {
    render(<OperationDetailPage />);
    expect(screen.getByText("Operation 不存在")).toBeInTheDocument();
  });
});
