import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipeCard } from "./RecipeCard";

const mockRecipe = {
  id: "rcp-1",
  name: "Check ClassName 规范",
  description: "检查 className 模板字符串",
  operationId: "op-1",
  bestPracticeId: "bp-1",
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockOperation = {
  id: "op-1",
  name: "Check",
  description: "",
  config: "{}",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  acceptedObjectTypes: [],
};

const mockBestPractice = {
  id: "bp-1",
  title: "ClassName 转换规则",
  condition: "",
  content: "",
  category: "component",
  language: "tsx",
  codeSnippet: "",
  tags: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("RecipeCard", () => {
  it("renders recipe name", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(
      <RecipeCard
        bestPractice={mockBestPractice}
        operation={mockOperation}
        recipe={mockRecipe}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    );
    expect(screen.getByText("Check ClassName 规范")).toBeInTheDocument();
  });

  it("renders operation and best practice names", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(
      <RecipeCard
        bestPractice={mockBestPractice}
        operation={mockOperation}
        recipe={mockRecipe}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    );
    expect(screen.getByText("Check")).toBeInTheDocument();
    expect(screen.getByText("ClassName 转换规则")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(
      <RecipeCard
        bestPractice={mockBestPractice}
        operation={mockOperation}
        recipe={mockRecipe}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    );
    expect(screen.getByText("检查 className 模板字符串")).toBeInTheDocument();
  });

  it("falls back to IDs when operation/bestPractice missing", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    render(<RecipeCard recipe={mockRecipe} onDelete={handleDelete} onEdit={handleEdit} />);
    expect(screen.getByText("op-1")).toBeInTheDocument();
    expect(screen.getByText("bp-1")).toBeInTheDocument();
  });
});
