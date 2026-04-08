import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationEditPage } from "./OperationEditPage";
import type { OperationEntity } from "@/models/daos/operationsDao";

const mockOp: OperationEntity = {
  id: "op-1",
  name: "Lint",
  description: null,
  category: "lint",
  visibility: "public",
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: 1000,
  updatedAt: 1000,
};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/routes/operations.$operationId.edit", () => ({
  Route: { useLoaderData: () => mockOp },
}));

describe("OperationEditPage", () => {
  it("renders inside AppLayout", () => {
    render(<OperationEditPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows 编辑 Operation heading", () => {
    render(<OperationEditPage />);
    expect(screen.getByText("编辑 Operation")).toBeInTheDocument();
  });
});
