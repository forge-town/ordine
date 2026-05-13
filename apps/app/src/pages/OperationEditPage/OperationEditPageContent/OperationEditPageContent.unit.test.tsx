import { render } from "@/test/test-wrapper";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OperationEditPageContent } from "./OperationEditPageContent";
import type { Operation, Skill } from "@repo/schemas";

const mockNavigate = vi.fn();
const mockUpdateMutateAsync = vi.fn().mockResolvedValue({ data: {} });

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({
  updateOperation: vi.fn(),
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useOperationEditPageStore: () =>
    createStore(() => ({
      skillOpen: false,
      scriptLangOpen: false,
      handleSetSkillOpen: vi.fn(),
      handleToggleSkillOpen: vi.fn(),
      handleSetScriptLangOpen: vi.fn(),
      handleToggleScriptLangOpen: vi.fn(),
    })),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: mockUpdateMutateAsync }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

const mockOp: Operation = {
  id: "op-123",
  name: "Run ESLint",
  description: "Lints the code",
  config: {
    inputs: [
      {
        name: "source",
        kind: "file",
        required: true,
        description: "File to lint",
      },
    ],
    outputs: [
      {
        name: "report",
        contentType: "markdown",
        description: "Lint report",
        templateIds: ["template-1"],
      },
    ],
    executor: { type: "script", command: "eslint src/" },
  },
  acceptedObjectTypes: ["file", "folder"],
  meta: { createdAt: new Date(1000), updatedAt: new Date(2000) },
};

const mockSkills: Skill[] = [
  {
    id: "skill-1",
    name: "lint-check",
    label: "Lint Check",
    description: "",
    category: "lint",
    tags: [],
    meta: { createdAt: new Date(1000), updatedAt: new Date(2000) },
  },
];

describe("OperationEditPageContent", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUpdateMutateAsync.mockClear();
  });

  it("renders inside a <form> element (react-hook-form)", () => {
    const { container } = render(
      <OperationEditPageContent operation={mockOp} skills={mockSkills} />,
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
    expect(screen.getByRole("button", { name: /Agent/i })).toBeInTheDocument();
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
    mockUpdateMutateAsync.mockResolvedValue({ data: { ...mockOp, name: "Run ESLint" } });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "op-123",
          values: expect.objectContaining({ name: "Run ESLint" }),
        }),
      );
    });
  });

  it("keeps existing inputs and outputs when saving executor changes", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ data: { ...mockOp } });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            config: expect.objectContaining({
              inputs: mockOp.config.inputs,
              outputs: mockOp.config.outputs,
              executor: expect.objectContaining({
                type: "script",
                command: "eslint src/",
              }),
            }),
          }),
        }),
      );
    });
  });

  it("saves edited output items", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ data: { ...mockOp } });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.change(screen.getByDisplayValue("report"), {
      target: { value: "lint-summary" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            config: expect.objectContaining({
              outputs: [
                expect.objectContaining({
                  name: "lint-summary",
                  contentType: "markdown",
                  description: "Lint report",
                  templateIds: ["template-1"],
                }),
              ],
            }),
          }),
        }),
      );
    });
  });

  it("adds new output items", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ data: { ...mockOp } });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /添加输出/ }));
    const outputNameInputs = screen.getAllByPlaceholderText(/例如 report/i);
    const newOutputNameInput = outputNameInputs.at(-1);
    expect(newOutputNameInput).toBeDefined();
    fireEvent.change(newOutputNameInput as HTMLElement, {
      target: { value: "new-output" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({
            config: expect.objectContaining({
              outputs: [
                expect.objectContaining({ name: "report" }),
                expect.objectContaining({
                  name: "new-output",
                  contentType: "markdown",
                  description: undefined,
                  templateIds: [],
                }),
              ],
            }),
          }),
        }),
      );
    });
  });

  it("navigates to detail page after successful save", async () => {
    mockUpdateMutateAsync.mockResolvedValue({ data: { ...mockOp } });
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/pipelines/operations/$operationId",
        params: { operationId: "op-123" },
      });
    });
  });

  it("navigates back on cancel", () => {
    render(<OperationEditPageContent operation={mockOp} skills={mockSkills} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/pipelines/operations/$operationId",
      params: { operationId: "op-123" },
    });
  });

  it("header back link points to pipeline operation detail route", () => {
    const { container } = render(
      <OperationEditPageContent operation={mockOp} skills={mockSkills} />,
    );
    const backLink = container.querySelector('a[href="/pipelines/operations/op-123"]');
    expect(backLink).not.toBeNull();
  });
});
