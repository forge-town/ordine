import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OperationEditPageContent } from "./OperationEditPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { SkillEntity } from "@/models/daos/skillsDao";

const mockNavigate = vi.fn();
const mockUpdateOperation = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: (...args: unknown[]) => mockUpdateOperation(...args),
}));

const mockOp: OperationEntity = {
  id: "op-123",
  name: "Run ESLint",
  description: "Lints the code",
  config: '{"command":"eslint src/"}',
  acceptedObjectTypes: ["file", "folder"],
  createdAt: 1000,
  updatedAt: 2000,
};

const mockSkills: SkillEntity[] = [
  {
    id: "skill-1",
    name: "lint-check",
    label: "Lint Check",
    description: "",
    category: "lint",
    tags: [],
    createdAt: 1000,
    updatedAt: 2000,
  },
];

describe("OperationEditPageContent", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUpdateOperation.mockClear();
  });

  it("renders inside a <form> element (react-hook-form)", () => {
    const { container } = render(
      <OperationEditPageContent operation={mockOp} skills={mockSkills} />
    );
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("renders the edit form pre-filled with operation data", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    const nameInput = screen.getByPlaceholderText(/e.g. Run ESLint/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Run ESLint");
  });

  it("renders description and executor type selector", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    expect(screen.getByPlaceholderText(/简单描述/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skill/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Prompt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Script/i })).toBeInTheDocument();
  });

  it("does not render a visibility field", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    expect(screen.queryByText(/可见性/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/公开/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/私有/i)).not.toBeInTheDocument();
  });

  it("shows 编辑 Operation header", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    expect(screen.getByText("编辑 Operation")).toBeInTheDocument();
  });

  it("shows validation error when name is cleared and form submitted", async () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    const nameInput = screen.getByPlaceholderText(/e.g. Run ESLint/i);
    fireEvent.change(nameInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/名称不能为空/i)).toBeInTheDocument();
    });
  });

  it("save button is visible", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    expect(screen.getByRole("button", { name: /保存/ })).toBeInTheDocument();
  });

  it("calls updateOperation with correct data on save", async () => {
    mockUpdateOperation.mockResolvedValue({ ...mockOp, name: "Run ESLint" });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockUpdateOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ id: "op-123", name: "Run ESLint" }),
        })
      );
    });
  });

  it("navigates to detail page after successful save", async () => {
    mockUpdateOperation.mockResolvedValue({ ...mockOp });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/operations/$operationId",
        params: { operationId: "op-123" },
      });
    });
  });

  it("navigates back on cancel", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/operations/$operationId",
      params: { operationId: "op-123" },
    });
  });
});
