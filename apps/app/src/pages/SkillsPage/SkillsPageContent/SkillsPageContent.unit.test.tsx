import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Skill } from "@repo/schemas";
import { SkillsPageStoreProvider } from "../_store";
import { SkillsPageContent } from "./SkillsPageContent";

const mockSkills: { data: Skill[] } = vi.hoisted(() => ({ data: [] }));
const mockCustom = vi.hoisted(() => vi.fn());
const mockCreateSkill = vi.hoisted(() => vi.fn());
const mockDeleteSkill = vi.hoisted(() => vi.fn());

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: mockSkills.data, total: mockSkills.data.length },
    query: { isLoading: false },
  }),
  useDataProvider: () => () => ({
    custom: mockCustom,
  }),
  useCreate: () => ({
    mutateAsync: mockCreateSkill,
  }),
  useDelete: () => ({
    mutateAsync: mockDeleteSkill,
  }),
}));

const renderContent = () =>
  render(
    <SkillsPageStoreProvider>
      <SkillsPageContent />
    </SkillsPageStoreProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockSkills.data = [
    {
      id: "skill-codex-review",
      name: "codex-review",
      label: "Code Review",
      description: "Review repository changes before shipping.",
      category: "code-quality",
      tags: ["codex", "review"],
      meta: { createdAt: new Date(), updatedAt: new Date() },
    },
    {
      id: "skill-claude-plan",
      name: "claude-code-plan",
      label: "Implementation Plan",
      description: "Draft a staged implementation plan.",
      category: "imported",
      tags: ["claude-code", "imported"],
      meta: { createdAt: new Date(), updatedAt: new Date() },
    },
  ];
});

describe("SkillsPageContent", () => {
  it("renders skill cards with source, operation, and IO metadata", () => {
    renderContent();

    expect(screen.getByText("codex-review")).toBeInTheDocument();
    expect(screen.getByText("imported from Codex")).toBeInTheDocument();
    expect(screen.getByText("repo -> review report")).toBeInTheDocument();
    expect(screen.getByText("powers Code Review Operation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜索|Search/)).toBeInTheDocument();
  });

  it("filters skills by source", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "Claude Code" }));

    expect(screen.queryByText("codex-review")).not.toBeInTheDocument();
    expect(screen.getByText("claude-code-plan")).toBeInTheDocument();
  });
});
