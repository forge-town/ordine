import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLoaderData: () => [],
  Link: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

describe("OperationsPageContent - create button navigation", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("navigates to /operations/new when 新建 Operation is clicked", () => {
    render(<OperationsPageContent />);
    fireEvent.click(screen.getByText("新建 Operation"));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/operations/new" });
  });

  it("does NOT open the inline form after clicking 新建 Operation", () => {
    render(<OperationsPageContent />);
    fireEvent.click(screen.getByText("新建 Operation"));
    expect(
      screen.queryByText("新建 Operation", { selector: "h2" }),
    ).not.toBeInTheDocument();
  });
});
