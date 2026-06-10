import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import type * as ZustandModule from "zustand";
import { PipelinesPage } from "./PipelinesPage";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: vi.fn() }),
  useList: () => ({
    query: { isLoading: false },
    result: { data: [] },
  }),
}));

vi.mock("@/store/sidebarStore", async () => {
  const { createStore } = await vi.importActual<typeof ZustandModule>("zustand");
  const mockSidebarStore = createStore(() => ({ currentProjectId: null }));

  return {
    useSidebarStore: () => mockSidebarStore,
  };
});

describe("PipelinesPage", () => {
  it("renders without crashing", () => {
    render(<PipelinesPage />);
    expect(document.body).toBeTruthy();
  });
});
