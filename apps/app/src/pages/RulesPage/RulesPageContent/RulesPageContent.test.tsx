import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RulesPageContent } from "./RulesPageContent";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => [],
}));

vi.mock("@/services/rulesService", () => ({
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  toggleRule: vi.fn(),
}));

vi.mock("../RuleCard", () => ({
  RuleCard: ({ rule }: { rule: { name: string } }) => <div>{rule.name}</div>,
}));

vi.mock("../RuleForm", () => ({
  RuleForm: () => <div>RuleForm</div>,
}));

describe("RulesPageContent", () => {
  it("renders empty state when no rules", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("暂无规则")).toBeTruthy();
  });

  it("renders header with Rules title", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("Rules")).toBeTruthy();
  });

  it("renders count badge", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("0 启用 / 0 总计")).toBeTruthy();
  });

  it("renders add button", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("新建规则")).toBeTruthy();
  });
});
