import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PracticeFormDialog } from "./PracticeFormDialog";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

vi.mock("@/services/bestPracticesService", () => ({
  createBestPractice: vi.fn(),
  updateBestPractice: vi.fn(),
}));

const mockPractice: BestPracticeEntity = {
  id: "bp-1",
  title: "避免在 useEffect 中直接 setState",
  condition: "当需要在组件挂载后获取异步数据时",
  category: "component",
  language: "typescript",
  codeSnippet: "",
  tags: ["react", "hooks"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("PracticeFormDialog", () => {
  it("renders 新增 title when no initial", () => {
    render(
      <PracticeFormDialog
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("新增最佳实践")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    render(
      <PracticeFormDialog
        initial={mockPractice}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("编辑最佳实践")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <PracticeFormDialog onClose={onClose} onSave={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /取消/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prefills form with initial data", () => {
    render(
      <PracticeFormDialog
        initial={mockPractice}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue(mockPractice.title)).toBeInTheDocument();
  });
});
