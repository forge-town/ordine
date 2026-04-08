import { render, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
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

const existingOp: OperationEntity = {
  id: "op-1",
  name: "Lint Check",
  description: "Runs ESLint",
  category: "lint",
  visibility: "public",
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: 1000,
  updatedAt: 1000,
};

describe("OperationsPageContent - no raw native inputs in form", () => {
  it("edit form renders no native <input> for name field (uses @repo/ui Input)", () => {
    const { container } = render(
      <OperationsPageContent initialOperations={[existingOp]} />,
    );
    // trigger edit to show the form
    const editBtn = container.querySelector('[title="编辑"]') as HTMLElement;
    fireEvent.click(editBtn);
    // The form should be visible now; check no raw <input> without data-slot="input"
    const rawInputs = [...container.querySelectorAll("input")].filter(
      (el) =>
        el.dataset.slot !== "input" &&
        el.type !== "file" &&
        !el.id.startsWith("base-ui-"),
    );
    expect(rawInputs).toHaveLength(0);
  });
});
