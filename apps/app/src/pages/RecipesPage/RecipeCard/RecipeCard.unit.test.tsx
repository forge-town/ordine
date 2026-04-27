import { render, screen } from "@testing-library/react";
import { createStore } from "zustand";
import { describe, expect, it, vi } from "vitest";
import { RecipeCard } from "./RecipeCard";

import type { ObjectType } from "@repo/schemas";

const mockMutate = vi.fn();
vi.mock("@refinedev/core", () => ({
  useDelete: () => ({ mutate: mockMutate }),
}));

const createMockStore = () =>
  createStore(() => ({
    handleSetEditing: vi.fn(),
    handleSetShowForm: vi.fn(),
  }));

vi.mock("../_store", () => ({
  useRecipesPageStore: () => createMockStore(),
}));

const mockRecipe = {
  id: "rcp-1",
  name: "Check ClassName 规范",
  description: "检查 className 模板字符串",
  operationId: "op-1",
  bestPracticeId: "bp-1",
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

const mockOperation = {
  id: "op-1",
  name: "Check",
  description: "",
  config: { inputs: [], outputs: [] },
  meta: { createdAt: new Date(), updatedAt: new Date() },
  acceptedObjectTypes: [] as ObjectType[],
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
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

describe("RecipeCard", () => {
  it("renders recipe name", () => {
    render(
      <RecipeCard bestPractice={mockBestPractice} operation={mockOperation} recipe={mockRecipe} />
    );
    expect(screen.getByText("Check ClassName 规范")).toBeInTheDocument();
  });

  it("renders operation and best practice names", () => {
    render(
      <RecipeCard bestPractice={mockBestPractice} operation={mockOperation} recipe={mockRecipe} />
    );
    expect(screen.getByText("Check")).toBeInTheDocument();
    expect(screen.getByText("ClassName 转换规则")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <RecipeCard bestPractice={mockBestPractice} operation={mockOperation} recipe={mockRecipe} />
    );
    expect(screen.getByText("检查 className 模板字符串")).toBeInTheDocument();
  });

  it("falls back to IDs when operation/bestPractice missing", () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText("op-1")).toBeInTheDocument();
    expect(screen.getByText("bp-1")).toBeInTheDocument();
  });
});
