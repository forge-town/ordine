import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipesPageContent } from "./RecipesPageContent";

vi.mock("@/services/recipesService", () => ({
  deleteRecipe: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

const mockLoaderData = vi.fn();
vi.mock("@/routes/_layout/recipes", () => ({
  Route: { useLoaderData: () => mockLoaderData() },
}));

const mockRecipes = [
  {
    id: "rcp-1",
    name: "Check ClassName 规范",
    description: "检查 className 模板字符串",
    operationId: "op-1",
    bestPracticeId: "bp-1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "rcp-2",
    name: "Clean Dead Code",
    description: "",
    operationId: "op-2",
    bestPracticeId: "bp-2",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

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
  {
    id: "op-2",
    name: "Clean",
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
  {
    id: "bp-2",
    title: "代码清理规范",
    condition: "",
    content: "",
    category: "general",
    language: "typescript",
    codeSnippet: "",
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("RecipesPageContent", () => {
  it("renders list of recipes", () => {
    mockLoaderData.mockReturnValue({
      recipes: mockRecipes,
      operations: mockOperations,
      bestPractices: mockBestPractices,
    });
    render(<RecipesPageContent />);
    expect(screen.getByText("Check ClassName 规范")).toBeInTheDocument();
    expect(screen.getByText("Clean Dead Code")).toBeInTheDocument();
  });

  it("renders empty state when no recipes", () => {
    mockLoaderData.mockReturnValue({
      recipes: [],
      operations: mockOperations,
      bestPractices: mockBestPractices,
    });
    render(<RecipesPageContent />);
    expect(screen.getByText("还没有任何配方")).toBeInTheDocument();
  });

  it("shows recipe count", () => {
    mockLoaderData.mockReturnValue({
      recipes: mockRecipes,
      operations: mockOperations,
      bestPractices: mockBestPractices,
    });
    render(<RecipesPageContent />);
    expect(screen.getByText("2 条")).toBeInTheDocument();
  });
});
