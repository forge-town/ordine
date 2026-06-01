import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { SkillsPageContent } from "./SkillsPageContent";

vi.mock("@/routes/_layout/pipelines.skills", () => ({
  Route: { useLoaderData: () => [] },
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useSkillsPageStore: () =>
    createStore(() => ({
      search: "",
      category: "all",
      handleSearchInputChange: vi.fn(),
      handleCategoryButtonClick: vi.fn(),
    })),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    query: { isLoading: false },
  }),
  useDataProvider: () => () => ({
    custom: vi.fn(),
  }),
  useCreate: () => ({
    mutateAsync: vi.fn(),
  }),
  useDelete: () => ({
    mutateAsync: vi.fn(),
  }),
}));

describe("SkillsPageContent", () => {
  it("renders with empty skills", () => {
    render(<SkillsPageContent />);
    expect(screen.getByPlaceholderText(/搜索/)).toBeInTheDocument();
  });
});
