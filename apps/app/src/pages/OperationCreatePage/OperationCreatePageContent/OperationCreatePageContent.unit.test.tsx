import { render } from "@/test/test-wrapper";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { OperationCreatePageContent } from "./OperationCreatePageContent";
import type { Skill } from "@repo/schemas";

const mockNavigate = vi.fn();
const mockCreateMutateAsync = vi.fn();

const mockSkills: Skill[] = [
  {
    id: "skill-1",
    name: "lint-check",
    label: "Lint Check",
    description: "",
    category: "lint",
    tags: [],
    createdAt: new Date(1000),
    updatedAt: new Date(2000),
  },
];

vi.mock("@/routes/_layout/operations.new", () => ({
  Route: { useLoaderData: () => mockSkills },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/services/operationsService", () => ({}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useOperationCreatePageStore: () =>
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
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: mockCreateMutateAsync }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

describe("OperationCreatePageContent", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCreateMutateAsync.mockClear();
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
    expect(screen.getByRole("button", { name: /Agent/i })).toBeInTheDocument();
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
    mockCreateMutateAsync.mockResolvedValue({ data: { id: "new-op-id", name: "Test Op" } });

    render(<OperationCreatePageContent />);
    fireEvent.change(screen.getByPlaceholderText(/e.g. Run ESLint/i), {
      target: { value: "Test Op" },
    });
    fireEvent.click(screen.getByRole("button", { name: /保存/ }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ name: "Test Op" }),
        })
      );
    });
  });

  it("navigates to /operations/$operationId after successful creation", async () => {
    mockCreateMutateAsync.mockResolvedValue({ data: { id: "new-op-id", name: "Test Op" } });

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
        })
      );
    });
  });

  it("navigates back to /operations when cancel is clicked", () => {
    render(<OperationCreatePageContent />);
    fireEvent.click(screen.getByRole("button", { name: /取消/ }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/operations" });
  });
});
