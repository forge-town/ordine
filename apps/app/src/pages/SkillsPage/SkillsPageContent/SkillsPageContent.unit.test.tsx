import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { SkillsPageContent } from "./SkillsPageContent";

vi.mock("@/routes/_layout/skills", () => ({
  Route: { useLoaderData: () => [] },
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useSkillsPageStore: () =>
    createStore(() => ({
      search: "",
      category: "all",
      handleSetSearch: vi.fn(),
      handleSetCategory: vi.fn(),
    })),
}));

describe("SkillsPageContent", () => {
  it("renders with empty skills", () => {
    render(<SkillsPageContent />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });
});
