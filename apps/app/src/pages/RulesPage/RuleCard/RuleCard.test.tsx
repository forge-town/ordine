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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("RuleCard", () => {
  it("renders rule name", () => {
    render(
      <RuleCard
        rule={mockRule}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("No console.log")).toBeTruthy();
  });

  it("renders description", () => {
    render(
      <RuleCard
        rule={mockRule}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("禁止使用 console.log")).toBeTruthy();
  });

  it("renders tags", () => {
    render(
      <RuleCard
        rule={mockRule}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("debug")).toBeTruthy();
    expect(screen.getByText("style")).toBeTruthy();
  });
});
