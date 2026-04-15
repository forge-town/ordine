import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeFormDialog } from "./RecipeFormDialog";

vi.mock("@/services/recipesService", () => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

const mockOperations = [
  {
    id: "op-1",
    name: "Check",
    description: "",
    config: "{}",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    acceptedObjectTypes: [],
  },
];

const mockBestPractices = [
  {
    id: "bp-1",
    title: "ClassName 转换规则",
    condition: "",
    content: "",
    category: "component",
    language: "tsx",
    codeSnippet: "",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockRecipe = {
  id: "rcp-1",
  name: "Check ClassName 规范",
  description: "",
  operationId: "op-1",
  bestPracticeId: "bp-1",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("RecipeFormDialog", () => {
  it("renders 新增 title when no initial", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(
      <RecipeFormDialog
        bestPractices={mockBestPractices}
        operations={mockOperations}
        onClose={handleClose}
        onSave={handleSave}
      />,
    );
    expect(screen.getByText("新增配方")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(
      <RecipeFormDialog
        bestPractices={mockBestPractices}
        initial={mockRecipe}
        operations={mockOperations}
        onClose={handleClose}
        onSave={handleSave}
      />,
    );
    expect(screen.getByText("编辑配方")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    const handleSave = vi.fn();
    render(
      <RecipeFormDialog
        bestPractices={mockBestPractices}
        operations={mockOperations}
        onClose={handleClose}
        onSave={handleSave}
      />,
    );
    const closeBtn = screen.getByRole("button", { name: "" });
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledOnce();
  });
});
