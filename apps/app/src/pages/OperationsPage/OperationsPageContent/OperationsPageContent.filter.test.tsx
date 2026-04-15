import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationRecord } from "@repo/db-schema";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLoaderData: () => ops,
  Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  createOperation: vi.fn(),
  updateOperation: vi.fn(),
  deleteOperation: vi.fn(),
}));

const makeOp = (id: string, name: string): OperationRecord => ({
  id,
  name,
  description: null,
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const ops: OperationRecord[] = [
  makeOp("op1", "Alpha Op"),
  makeOp("op2", "Beta Op"),
  makeOp("op3", "Gamma Op"),
];

describe("OperationsPageContent – displays all operations", () => {
  it("shows all ops in the list", () => {
    render(<OperationsPageContent />);
    expect(screen.getByText("Alpha Op")).toBeInTheDocument();
    expect(screen.getByText("Beta Op")).toBeInTheDocument();
    expect(screen.getByText("Gamma Op")).toBeInTheDocument();
  });
});
