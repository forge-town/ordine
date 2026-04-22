import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleCard } from "./RuleCard";
import type { Rule } from "@repo/schemas";

const mockRule: Rule = {
  id: "rule-1",
  name: "No console.log",
  description: "禁止使用 console.log",
  category: "lint",
  severity: "warning",
  checkScript: "grep -rn 'console.log' $INPUT_PATH && exit 1 || exit 0",
  scriptLanguage: "typescript" as const,
  acceptedObjectTypes: ["file", "folder", "project"],
  enabled: true,
  tags: ["debug", "style"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("RuleCard", () => {
  it("renders rule name", () => {
    const handleDelete = vi.fn();
    const handleToggle = vi.fn();
    const handleNavigateToDetail = vi.fn();
    const handleNavigateToEdit = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onNavigateToDetail={handleNavigateToDetail}
        onNavigateToEdit={handleNavigateToEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("No console.log")).toBeTruthy();
  });

  it("renders description", () => {
    const handleDelete = vi.fn();
    const handleToggle = vi.fn();
    const handleNavigateToDetail = vi.fn();
    const handleNavigateToEdit = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onNavigateToDetail={handleNavigateToDetail}
        onNavigateToEdit={handleNavigateToEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("禁止使用 console.log")).toBeTruthy();
  });

  it("renders tags", () => {
    const handleDelete = vi.fn();
    const handleToggle = vi.fn();
    const handleNavigateToDetail = vi.fn();
    const handleNavigateToEdit = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onNavigateToDetail={handleNavigateToDetail}
        onNavigateToEdit={handleNavigateToEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("debug")).toBeTruthy();
    expect(screen.getByText("style")).toBeTruthy();
  });
});
