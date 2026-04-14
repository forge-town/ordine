import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeFormDialog } from "./PracticeFormDialog";
import type { BestPracticeEntity } from "@repo/models";

vi.mock("@/services/bestPracticesService", () => ({
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

const mockPractice: BestPracticeEntity = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  content: "",
  category: "component",
  language: "typescript",
  codeSnippet: "",
  tags: ["react", "hooks"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("PracticeFormDialog", () => {
  it("renders 新增 title when no initial", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog onClose={handleClose} onSave={handleSave} />);
    expect(screen.getByText("新增最佳实践")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog initial={mockPractice} onClose={handleClose} onSave={handleSave} />);
    expect(screen.getByText("编辑最佳实践")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog onClose={handleClose} onSave={handleSave} />);
    fireEvent.click(screen.getByRole("button", { name: /取消/i }));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("prefills form with initial data", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog initial={mockPractice} onClose={handleClose} onSave={handleSave} />);
    expect(screen.getByDisplayValue(mockPractice.title)).toBeInTheDocument();
  });

  it("renders inside a <form> element (react-hook-form)", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    const { container } = render(<PracticeFormDialog onClose={handleClose} onSave={handleSave} />);
    expect(container.querySelector("form")).not.toBeNull();
  });

  it("shows validation error when submitting with empty title", async () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog onClose={handleClose} onSave={handleSave} />);
    fireEvent.click(screen.getByRole("button", { name: /^保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/标题不能为空/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when submitting with empty condition", async () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(<PracticeFormDialog onClose={handleClose} onSave={handleSave} />);
    fireEvent.click(screen.getByRole("button", { name: /^保存/ }));
    await waitFor(() => {
      expect(screen.getByText(/适用时机不能为空/i)).toBeInTheDocument();
    });
  });
});
