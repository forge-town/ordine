import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationDetailPage } from "./OperationDetailPage";

vi.mock("@/routes/operations.$operationId", () => ({
  Route: { useLoaderData: () => null },
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: vi.fn().mockResolvedValue({}),
}));

describe("OperationDetailPage", () => {
  it("renders inside AppLayout", () => {
    render(<OperationDetailPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows 不存在 message when operation is null", () => {
    render(<OperationDetailPage />);
    expect(screen.getByText("Operation 不存在")).toBeInTheDocument();
  });
});
