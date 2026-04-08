import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationsPage } from "./OperationsPage";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => [],
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn().mockResolvedValue({}),
  deleteOperation: vi.fn().mockResolvedValue({}),
  updateOperation: vi.fn().mockResolvedValue({}),
  exportOperation: vi.fn().mockResolvedValue({}),
  importOperation: vi.fn().mockResolvedValue({}),
}));

describe("OperationsPage", () => {
  it("renders inside AppLayout", () => {
    render(<OperationsPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
