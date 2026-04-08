import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RuleCard } from "./RuleCard";
import type { RuleEntity } from "@/models/daos/rulesDao";

const mockRule: RuleEntity = {
  id: "rule-1",
  name: "No console.log",
  description: "禁止使用 console.log",
  category: "lint",
  severity: "warning",
  pattern: "console\\.log",
  enabled: true,
  tags: ["debug", "style"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("RuleCard", () => {
  it("renders rule name", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    const handleToggle = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("No console.log")).toBeTruthy();
  });

  it("renders description", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    const handleToggle = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("禁止使用 console.log")).toBeTruthy();
  });

  it("renders tags", () => {
    const handleDelete = vi.fn();
    const handleEdit = vi.fn();
    const handleToggle = vi.fn();
    render(
      <RuleCard
        rule={mockRule}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onToggle={handleToggle}
      />
    );
    expect(screen.getByText("debug")).toBeTruthy();
    expect(screen.getByText("style")).toBeTruthy();
  });
});
