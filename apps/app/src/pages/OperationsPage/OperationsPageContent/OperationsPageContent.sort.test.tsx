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

vi.mock("@repo/ui/select", () => ({
  Select: ({
    value,
    onValueChange: handleValueChange = () => {},
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => (
    <select
      aria-label="排序"
      value={value ?? ""}
      onChange={(e) => handleValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectGroup: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children?: React.ReactNode;
  }) => <option value={value}>{children}</option>,
  SelectLabel: () => null,
  SelectSeparator: () => null,
  SelectScrollUpButton: () => null,
  SelectScrollDownButton: () => null,
}));

const makeOp = (
  id: string,
  name: string,
  category: string,
  createdAt: number,
): OperationEntity => ({
  id,
  name,
  description: null,
  category,
  visibility: "public",
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt,
  updatedAt: createdAt,
});

// Declared oldest → newest, names out-of-order
const ops: OperationEntity[] = [
  makeOp("op3", "Zebra Task", "deploy", 1000),
  makeOp("op1", "Alpha Task", "lint", 3000),
  makeOp("op2", "Mango Task", "build", 2000),
];

const getCardNames = () => {
  return screen.getAllByText(/Task$/).map((el) => el.textContent ?? "");
};

describe("OperationsPageContent – sort", () => {
  it("renders a sort selector", () => {
    render(<OperationsPageContent />);
    expect(screen.getByRole("combobox", { name: /排序/i })).toBeInTheDocument();
  });

  it("default order preserves insertion order", () => {
    render(<OperationsPageContent />);
    const names = getCardNames();
    expect(names).toEqual(["Zebra Task", "Alpha Task", "Mango Task"]);
  });

  it("sort by name ascending (A → Z)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /排序/i }),
      "name-asc",
    );
    expect(getCardNames()).toEqual(["Alpha Task", "Mango Task", "Zebra Task"]);
  });

  it("sort by name descending (Z → A)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /排序/i }),
      "name-desc",
    );
    expect(getCardNames()).toEqual(["Zebra Task", "Mango Task", "Alpha Task"]);
  });

  it("sort by newest first (createdAt desc)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /排序/i }),
      "date-desc",
    );
    expect(getCardNames()).toEqual(["Alpha Task", "Mango Task", "Zebra Task"]);
  });

  it("sort by oldest first (createdAt asc)", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /排序/i }),
      "date-asc",
    );
    expect(getCardNames()).toEqual(["Zebra Task", "Mango Task", "Alpha Task"]);
  });

  it("sort by category ascending", async () => {
    const user = userEvent.setup();
    render(<OperationsPageContent />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /排序/i }),
      "category-asc",
    );
    // build < deploy < lint
    expect(getCardNames()).toEqual(["Mango Task", "Zebra Task", "Alpha Task"]);
  });
});
