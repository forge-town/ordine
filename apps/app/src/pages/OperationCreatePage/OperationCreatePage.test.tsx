import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationCreatePage } from "./OperationCreatePage";

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
  createOperation: vi.fn().mockResolvedValue({}),
}));

describe("OperationCreatePage", () => {
  it("renders inside AppLayout", () => {
    render(<OperationCreatePage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});
