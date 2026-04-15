import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationRow } from "@repo/models";

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

const makeOp = (id: string, name: string, description: string | null): OperationRow => ({
  id,
  name,
  description,
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const ops: OperationRow[] = [
  makeOp("op1", "Constitution Plan", "Set up project principles"),
  makeOp("op2", "Run ESLint", "Lint the source code"),
  makeOp("op3", "Deploy Build", null),
];

describe("OperationsPageContent – search", () => {
  it("renders a search input", () => {
    render(<OperationsPageContent />);
    expect(screen.getByPlaceholderText(/搜索/i)).toBeInTheDocument();
  });

  it("shows all ops when search is empty", () => {
    render(<OperationsPageContent />);
    expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
    expect(screen.getByText("Run ESLint")).toBeInTheDocument();
    expect(screen.getByText("Deploy Build")).toBeInTheDocument();
  });

  it("filters by name (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.type(screen.getByPlaceholderText(/搜索/i), "eslint");
    expect(screen.getByText("Run ESLint")).toBeInTheDocument();
    expect(screen.queryByText("Constitution Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Deploy Build")).not.toBeInTheDocument();
  });

  it("filters by description (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.type(screen.getByPlaceholderText(/搜索/i), "principles");
    expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
    expect(screen.queryByText("Run ESLint")).not.toBeInTheDocument();
  });

  it("shows empty message when no ops match search", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.type(screen.getByPlaceholderText(/搜索/i), "zzznomatch");
    expect(screen.getByText("不存在")).toBeInTheDocument();
  });

  it("clears search and shows all ops again", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    const input = screen.getByPlaceholderText(/搜索/i);
    await user.type(input, "eslint");
    await user.clear(input);
    expect(screen.getByText("Constitution Plan")).toBeInTheDocument();
    expect(screen.getByText("Run ESLint")).toBeInTheDocument();
    expect(screen.getByText("Deploy Build")).toBeInTheDocument();
  });
});
