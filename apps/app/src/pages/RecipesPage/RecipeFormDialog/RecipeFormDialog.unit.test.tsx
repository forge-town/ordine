import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeFormDialog } from "./RecipeFormDialog";
import { createStore } from "zustand";

import type { ObjectType } from "@repo/schemas";

const mockSetShowForm = vi.fn();
const mockSetEditing = vi.fn();

vi.mock("@/services/recipesService", () => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

vi.mock("../_store", () => ({
  useRecipesPageStore: () =>
    createStore(() => ({
      search: "",
      showForm: true,
      editing: null,
      handleSetSearch: vi.fn(),
      handleSetShowForm: mockSetShowForm,
      handleSetEditing: mockSetEditing,
    })),
}));

const mockOperations = [
  {
    id: "op-1",
    name: "Check",
    description: "",
    config: { inputs: [], outputs: [] },
    meta: { createdAt: new Date(), updatedAt: new Date() },
    acceptedObjectTypes: [] as ObjectType[],
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
    meta: { createdAt: new Date(), updatedAt: new Date() },
  },
];

const mockRecipe = {
  id: "rcp-1",
  name: "Check ClassName 规范",
  description: "",
  operationId: "op-1",
  bestPracticeId: "bp-1",
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("RecipeFormDialog", () => {
  it("renders 新增 title when no initial", () => {
    render(<RecipeFormDialog bestPractices={mockBestPractices} operations={mockOperations} />);
    expect(screen.getByText("新增配方")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    render(
      <RecipeFormDialog
        bestPractices={mockBestPractices}
        initial={mockRecipe}
        operations={mockOperations}
      />
    );
    expect(screen.getByText("编辑配方")).toBeInTheDocument();
  });

  it("calls store close actions when close button is clicked", () => {
    render(<RecipeFormDialog bestPractices={mockBestPractices} operations={mockOperations} />);
    const closeBtn = screen.getByRole("button", { name: "" });
    closeBtn.click();
    expect(mockSetShowForm).toHaveBeenCalledWith(false);
    expect(mockSetEditing).toHaveBeenCalledWith(null);
  });
});
