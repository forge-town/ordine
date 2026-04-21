import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { PipelinesPageContent } from "./PipelinesPageContent";

vi.mock("@/routes/_layout/pipelines.index", () => ({
  Route: { useLoaderData: () => [] },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/services/pipelinesService", () => ({
  createPipeline: vi.fn().mockResolvedValue({ id: "new-pipe" }),
  deletePipeline: vi.fn().mockResolvedValue({}),
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  usePipelinesPageStore: () =>
    createStore(() => ({
      search: "",
      selectedTags: [],
      handleSetSearch: vi.fn(),
      handleSetSelectedTags: vi.fn(),
      handleToggleTag: vi.fn(),
      handleClearTags: vi.fn(),
    })),
}));

describe("PipelinesPageContent", () => {
  it("renders with no pipelines", () => {
    render(<PipelinesPageContent />);
    expect(screen.getByText("流水线")).toBeInTheDocument();
  });
});
