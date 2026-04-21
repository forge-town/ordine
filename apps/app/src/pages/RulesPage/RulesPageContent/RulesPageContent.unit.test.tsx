import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { RulesPageContent } from "./RulesPageContent";

vi.mock("@tanstack/react-router", () => ({
  useLoaderData: () => [],
  useNavigate: () => vi.fn(),
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

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useRulesPageStore: () => createStore(() => ({ search: "", handleSetSearch: vi.fn() })),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: null, isLoading: false }),
}));

describe("RulesPageContent", () => {
  it("renders empty state when no rules", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("还没有任何规则")).toBeTruthy();
  });

  it("renders header with Rules title", () => {
    render(<RulesPageContent />);
    expect(screen.getByText("规则")).toBeTruthy();
  });

  it("renders count badge", () => {
    render(<RulesPageContent />);
    expect(screen.getByText(/0 启用.*0 全部/)).toBeTruthy();
  });

  it("renders add button", () => {
    render(<RulesPageContent />);
    expect(screen.getAllByText("新建规则").length).toBeGreaterThan(0);
  });
});
