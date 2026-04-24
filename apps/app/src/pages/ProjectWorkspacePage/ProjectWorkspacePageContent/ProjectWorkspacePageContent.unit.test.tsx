import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { ProjectWorkspacePageContent } from "./ProjectWorkspacePageContent";

vi.mock("@/routes/_layout/projects.$projectId.workspace", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
    useParams: () => ({ projectId: "proj-1" }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
}));

import { createStore } from "zustand";
vi.mock("../_store", () => ({
  useProjectWorkspacePageStore: () =>
    createStore(() => ({
      selectedObjects: new Set(),
      selectedPipelineId: null,
      handleToggleObject: vi.fn(),
      handleSelectPipeline: vi.fn(),
      handleClearSelectedObjects: vi.fn(),
    })),
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

describe("ProjectWorkspacePageContent", () => {
  it("shows not found when project is null", () => {
    render(<ProjectWorkspacePageContent />);
    expect(screen.getByText("项目不存在")).toBeInTheDocument();
  });
});
