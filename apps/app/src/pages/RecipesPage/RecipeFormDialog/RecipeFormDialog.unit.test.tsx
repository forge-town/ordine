import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeFormDialog } from "./RecipeFormDialog";
import { createStore } from "zustand";

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

import type { Operation } from "@repo/schemas";

const mockOperations: Operation[] = [
  {
    id: "op-1",
    name: "Check",
    description: "",
    config: { inputs: [], outputs: [] },
    meta: { createdAt: new Date(), updatedAt: new Date() },
    acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
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
    render(<RecipeFormDialog operations={mockOperations} />);
    expect(screen.getByText("新增配方")).toBeInTheDocument();
  });

  it("renders 编辑 title when initial is provided", () => {
    render(<RecipeFormDialog initial={mockRecipe} operations={mockOperations} />);
    expect(screen.getByText("编辑配方")).toBeInTheDocument();
  });

  it("calls store close actions when close button is clicked", () => {
    render(<RecipeFormDialog operations={mockOperations} />);
    const closeBtn = screen.getByRole("button", { name: "" });
    closeBtn.click();
    expect(mockSetShowForm).toHaveBeenCalledWith(false);
    expect(mockSetEditing).toHaveBeenCalledWith(null);
  });
});
