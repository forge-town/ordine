import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OperationsPageContent } from "./OperationsPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLoaderData: () => ops,
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

const makeOp = (
  id: string,
  name: string,
  visibility: "public" | "private" | "team",
): OperationEntity => ({
  id,
  name,
  description: null,
  category: "general",
  visibility,
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const ops: OperationEntity[] = [
  makeOp("op1", "Public Op", "public"),
  makeOp("op2", "Private Op", "private"),
  makeOp("op3", "Team Op", "team"),
];

describe("OperationsPageContent – visibility filter", () => {
  it("shows all ops when no filter is selected (default = all)", () => {
    render(<OperationsPageContent />);
    expect(screen.getByText("Public Op")).toBeInTheDocument();
    expect(screen.getByText("Private Op")).toBeInTheDocument();
    expect(screen.getByText("Team Op")).toBeInTheDocument();
  });

  it("filters to show only public ops when 'public' filter is clicked", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.click(screen.getByRole("button", { name: /公开/i }));
    expect(screen.getByText("Public Op")).toBeInTheDocument();
    expect(screen.queryByText("Private Op")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Op")).not.toBeInTheDocument();
  });

  it("filters to show only private ops when 'private' filter is clicked", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.click(screen.getByRole("button", { name: /私有/i }));
    expect(screen.getByText("Private Op")).toBeInTheDocument();
    expect(screen.queryByText("Public Op")).not.toBeInTheDocument();
    expect(screen.queryByText("Team Op")).not.toBeInTheDocument();
  });

  it("filters to show only team ops when 'team' filter is clicked", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.click(screen.getByRole("button", { name: /团队/i }));
    expect(screen.getByText("Team Op")).toBeInTheDocument();
    expect(screen.queryByText("Public Op")).not.toBeInTheDocument();
    expect(screen.queryByText("Private Op")).not.toBeInTheDocument();
  });

  it("resets to show all ops when 'all' filter is clicked after filtering", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.click(screen.getByRole("button", { name: /公开/i }));
    await user.click(screen.getByRole("button", { name: /全部/i }));
    expect(screen.getByText("Public Op")).toBeInTheDocument();
    expect(screen.getByText("Private Op")).toBeInTheDocument();
    expect(screen.getByText("Team Op")).toBeInTheDocument();
  });
});
