import { render } from "@/test/test-wrapper";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeFormDialog } from "./PracticeFormDialog";
import { createStore } from "zustand";
import type { BestPractice } from "@repo/schemas";

const mockSetShowForm = vi.fn();

vi.mock("@/services/bestPracticesService", () => ({
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

vi.mock("../_store", () => ({
  useBestPracticesPageStore: () =>
    createStore(() => ({
      search: "",
      activeCategory: "all",
      showForm: true,
      handleSetSearch: vi.fn(),
      handleSetActiveCategory: vi.fn(),
      handleSetShowForm: mockSetShowForm,
    })),
}));

const mockPractice: BestPractice = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  content: "",
  category: "component",
  language: "typescript",
  codeSnippet: "",
  tags: ["react", "hooks"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("PracticeFormDialog", () => {
  it("renders 新增 title when no initial", () => {
    render(<PracticeFormDialog />);
    expect(screen.getByText("新增最佳实践")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    render(<PracticeFormDialog initial={mockPractice} />);
    expect(screen.getByText("编辑最佳实践")).toBeInTheDocument();
  });

  it("calls store handleSetShowForm(false) when cancel is clicked", () => {
    render(<PracticeFormDialog />);
    fireEvent.click(screen.getByRole("button", { name: /取消/i }));
    expect(mockSetShowForm).toHaveBeenCalledWith(false);
  });

  it("prefills form with initial data", () => {
    render(<PracticeFormDialog initial={mockPractice} />);
    expect(screen.getByDisplayValue(mockPractice.title)).toBeInTheDocument();
  });

  it("renders inside a <form> element (react-hook-form)", () => {
    const { container } = render(<PracticeFormDialog />);
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("shows validation error when submitting with empty title", async () => {
    render(<PracticeFormDialog />);
    fireEvent.click(screen.getByRole("button", { name: /^保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/标题不能为空/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when submitting with empty condition", async () => {
    render(<PracticeFormDialog />);
    fireEvent.click(screen.getByRole("button", { name: /^保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/适用时机不能为空/i)).toBeInTheDocument();
    });
  });
});
