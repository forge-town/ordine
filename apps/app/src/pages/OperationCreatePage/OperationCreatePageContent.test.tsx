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

  it("renders the create form with name input", () => {
    render(<OperationCreatePageContent />);
    expect(screen.getByPlaceholderText(/e.g. Run ESLint/i)).toBeInTheDocument();
  });

  it("renders category, description, and config fields", () => {
    render(<OperationCreatePageContent />);
    expect(screen.getByPlaceholderText(/简单描述/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/command/i)).toBeInTheDocument();
  });

  it("save button is disabled when name is empty", () => {
    render(<OperationCreatePageContent />);
    const saveBtn = screen.getByRole("button", { name: /保存/ });
    expect(saveBtn).toBeDisabled();
  });

  it("save button is enabled when name has value", () => {
    render(<OperationCreatePageContent />);
    fireEvent.change(screen.getByPlaceholderText(/e.g. Run ESLint/i), {
      target: { value: "My Op" },
    });
    const saveBtn = screen.getByRole("button", { name: /保存/ });
    expect(saveBtn).not.toBeDisabled();
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
