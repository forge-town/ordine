import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationEntity } from "@repo/models";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  useLoaderData: () => [existingOp],
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

const existingOp: OperationEntity = {
  id: "op-1",
  name: "Lint Check",
  description: "Runs ESLint",
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: 1000,
  updatedAt: 1000,
};

describe("OperationsPageContent - edit button navigates to edit page", () => {
  it("clicking edit button navigates to /operations/$operationId/edit", () => {
    const { container } = render(<OperationsPageContent />);
    const editBtn = container.querySelector('[title="编辑"]') as HTMLElement;
    fireEvent.click(editBtn);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/operations/$operationId/edit",
      params: { operationId: "op-1" },
    });
  });

  it("clicking edit button does NOT show an inline form", () => {
    const { container, queryByText } = render(<OperationsPageContent />);
    const editBtn = container.querySelector('[title="编辑"]') as HTMLElement;
    fireEvent.click(editBtn);
    expect(queryByText("编辑 Operation", { selector: "h2" })).not.toBeInTheDocument();
  });
});
