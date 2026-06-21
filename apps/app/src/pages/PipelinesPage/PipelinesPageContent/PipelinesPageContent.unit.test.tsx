import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Job, PipelineAsset, PipelineData, Routine } from "@repo/schemas";
import type * as ZustandModule from "zustand";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PipelinesPageStoreProvider } from "../_store";
import { PipelinesPageContent } from "./PipelinesPageContent";

const now = new Date("2026-06-10T10:00:00.000Z");

const makePipeline = (patch: Partial<PipelineData>): PipelineData => ({
  id: "pipe-1",
  projectId: null,
  version: 1,
  name: "Textbook to Notion Quiz",
  description: "Parse PDFs into quiz questions.",
  status: "ready",
  tags: [],
  timeoutMs: null,
  createdAt: now,
  updatedAt: now,
  nodes: [
    {
      id: "prompt-1",
      type: "prompt",
      position: { x: 0, y: 0 },
      data: { label: "Prompt", nodeType: "prompt", prompt: "Make a quiz" },
    },
  ],
  edges: [],
  ...patch,
});

const { mockCreate, mockNavigate, mockUseListData } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseListData: vi.fn<(resource: string) => unknown[]>((resource) => {
    if (resource === "pipelines") {
      return [
        {
          id: "pipe-1",
          projectId: null,
          name: "Textbook to Notion Quiz",
          description: "Parse PDFs into quiz questions.",
          status: "ready",
          tags: [],
          timeoutMs: null,
          createdAt: new Date("2026-06-10T10:00:00.000Z"),
          updatedAt: new Date("2026-06-10T10:00:00.000Z"),
          nodes: [
            {
              id: "prompt-1",
              type: "prompt",
              position: { x: 0, y: 0 },
              data: { label: "Prompt", nodeType: "prompt", prompt: "Make a quiz" },
            },
          ],
          edges: [],
        },
      ];
    }

    return [];
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutateAsync: mockCreate }),
  useList: ({ resource }: { resource: string }) => ({
    query: { isLoading: false },
    result: { data: mockUseListData(resource) },
  }),
}));

vi.mock("@/store/sidebarStore", async () => {
  const { createStore } = await vi.importActual<typeof ZustandModule>("zustand");
  const mockSidebarStore = createStore(() => ({ currentProjectId: "project-1" }));

  return {
    useSidebarStore: () => mockSidebarStore,
  };
});

const renderContent = () =>
  render(<PipelinesPageContent />, {
    wrapper: ({ children }) => <PipelinesPageStoreProvider>{children}</PipelinesPageStoreProvider>,
  });

describe("PipelinesPageContent", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockNavigate.mockClear();
    mockUseListData.mockImplementation((resource: string) => {
      if (resource === ResourceName.pipelines) return [makePipeline({})];
      if (resource === ResourceName.pipelineAssets) {
        return [
          { id: "asset-1", pipelineId: "pipe-1", name: "Quiz" },
        ] satisfies Partial<PipelineAsset>[];
      }
      if (resource === ResourceName.routines) {
        return [
          { id: "routine-1", pipelineId: "pipe-1", name: "Daily review" },
        ] satisfies Partial<Routine>[];
      }
      if (resource === ResourceName.jobs) {
        return [
          {
            id: "job-1",
            pipelineId: "pipe-1",
            title: "Run",
            type: "pipeline_run",
            status: "done",
            parentJobId: null,
            error: null,
            startedAt: new Date("2026-06-10T10:00:00.000Z"),
            finishedAt: new Date("2026-06-10T10:00:05.000Z"),
            meta: { createdAt: now, updatedAt: now },
          },
        ] satisfies Partial<Job>[];
      }

      return [];
    });
  });

  it("renders pipeline cards with filters and run metadata", () => {
    renderContent();

    expect(screen.getByRole("heading", { name: "Pipelines" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saved Skills1/ })).toBeInTheDocument();
    expect(screen.getByText("Textbook to Notion Quiz")).toBeInTheDocument();
    expect(screen.getByText("Saved Skill")).toBeInTheDocument();
    expect(screen.getByText("Routine")).toBeInTheDocument();
    expect(screen.getByText("1 runs")).toBeInTheDocument();
  });

  it("filters cards from search input", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.type(screen.getByPlaceholderText("Search pipelines..."), "missing");

    expect(screen.getByText("No matching pipelines")).toBeInTheDocument();
  });

  it("creates a draft pipeline for the current project and opens workspace", async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({
      data: makePipeline({ id: "new-pipe", projectId: "project-1", name: "Untitled pipeline" }),
    });

    renderContent();

    await user.click(screen.getByRole("button", { name: /New Pipeline/ }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: ResourceName.pipelines,
        values: expect.objectContaining({
          projectId: "project-1",
          status: "draft",
        }),
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/workspace/$pipelineId",
      params: { pipelineId: "new-pipe" },
    });
  });
});
