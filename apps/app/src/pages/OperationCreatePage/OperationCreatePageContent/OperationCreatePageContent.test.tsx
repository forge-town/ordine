import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OperationCreatePageContent } from "./OperationCreatePageContent";

const mockNavigate = vi.fn();
const mockCreateOperation = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: (...args: unknown[]) => mockCreateOperation(...args),
}));

describe("OperationCreatePageContent", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateOperation.mockClear();
  });

  it("renders inside a <form> element (react-hook-form)", () => {
    const { container } = render(<OperationCreatePageContent />);
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("renders the create form with name input", () => {
    render(<OperationCreatePageContent />);
    expect(screen.getByPlaceholderText(/e.g. Run ESLint/i)).toBeInTheDocument();
  });

  it("renders description and executor type selector", () => {
    render(<OperationCreatePageContent />);
    expect(screen.getByPlaceholderText(/简单描述/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prompt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Script/i })).toBeInTheDocument();
  });

  it("does not render a visibility field", () => {
    render(<OperationCreatePageContent />);
    expect(screen.queryByText(/可见性/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/公开/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/私有/i)).not.toBeInTheDocument();
  });

  it("shows validation error when submitting with empty name", async () => {
    render(<OperationCreatePageContent />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/名称不能为空/i)).toBeInTheDocument();
    });
  });

  it("calls createOperation with correct data on save", async () => {
    mockCreateOperation.mockResolvedValue({ id: "new-op-id", name: "Test Op" });

    render(<OperationCreatePageContent />);
    fireEvent.change(screen.getByPlaceholderText(/e.g. Run ESLint/i), {
      target: { value: "Test Op" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockCreateOperation).toHaveBeenCalledTimes(1);
      expect(mockCreateOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: "Test Op" }),
        }),
      );
    });
  });

  it("navigates to /operations/$operationId after successful creation", async () => {
    mockCreateOperation.mockResolvedValue({ id: "new-op-id", name: "Test Op" });

    render(<OperationCreatePageContent />);
    fireEvent.change(screen.getByPlaceholderText(/e.g. Run ESLint/i), {
      target: { value: "Test Op" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "/operations/$operationId",
          params: { operationId: "new-op-id" },
        }),
      );
    });
  });

  it("navigates back to /operations when cancel is clicked", () => {
    render(<OperationCreatePageContent />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/operations" });
  });
});
