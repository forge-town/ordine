import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationEditPage } from "./OperationEditPage";
import type { OperationEntity } from "@repo/models";

const mockOp: OperationEntity = {
  id: "op-1",
  name: "Lint",
  description: null,
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
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
  Route: { useLoaderData: () => ({ operation: mockOp, skills: [] }) },
}));

describe("OperationEditPage", () => {
  it("shows 编辑 Operation heading", () => {
    render(<OperationEditPage />);
    expect(screen.getByText("编辑 Operation")).toBeInTheDocument();
  });
});
