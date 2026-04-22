import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { OperationEditPage } from "./OperationEditPage";
import type { Operation } from "@repo/schemas";

const mockOp: Operation = {
  id: "op-1",
  name: "Lint",
  description: null,
  config: { inputs: [], outputs: [] },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(1000), updatedAt: new Date(1000) },
};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/routes/_layout/operations.$operationId.edit", () => ({
  Route: {
    useLoaderData: () => ({ operation: mockOp, skills: [] }),
    useParams: () => ({ operationId: "op-1" }),
  },
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
  useOne: () => ({ result: mockOp, isLoading: false }),
}));

describe("OperationEditPage", () => {
  it("shows 编辑 Operation heading", () => {
    render(<OperationEditPage />);
    expect(screen.getByText("编辑 Operation")).toBeInTheDocument();
  });
});
