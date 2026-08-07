import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation, PipelineAsset } from "@repo/schemas";
import { render } from "../../../test/test-wrapper";
import { ResourceName } from "../../../constants";
import { ComponentsPageContent } from "./ComponentsPageContent";

const mocks = vi.hoisted(() => ({
  custom: vi.fn(),
  deleteResource: vi.fn(),
  navigate: vi.fn(),
  refetchAssets: vi.fn(),
  refetchOperations: vi.fn(),
  updateResource: vi.fn(),
}));

const mockOperation: Operation = {
  id: "review-code",
  name: "Review Code",
  description: "Find correctness issues before merging.",
  config: { inputs: [], outputs: [] },
  acceptedObjectTypes: ["file", "github-project"],
};

const mockAsset: PipelineAsset = {
  id: "asset-1",
  pipelineId: "pipe-1",
  name: "Release Review",
  description: "Reusable release review pipeline.",
  snapshotNodes: [
    {
      id: "node-1",
      type: "operation",
      position: { x: 0, y: 0 },
      data: {
        label: "Review",
        nodeType: "operation",
        operationId: "review-code",
        operationName: "Review Code",
        status: "idle",
      },
    },
  ],
  snapshotEdges: [],
  inputSlots: [],
  totalRuns: 3,
  successRate: 1,
  avgDurationMs: 1200,
  tags: ["review"],
  createdAt: new Date("2026-06-10T10:00:00.000Z"),
  updatedAt: new Date("2026-06-10T10:00:00.000Z"),
};

const secondMockAsset: PipelineAsset = {
  ...mockAsset,
  id: "asset-2",
  name: "Deploy Review",
  totalRuns: 4,
};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@refinedev/core")>()),
  useDataProvider: () => () => ({ custom: mocks.custom }),
  useDelete: () => ({ mutateAsync: mocks.deleteResource }),
  useList: ({ resource }: { resource: string }) =>
    resource === ResourceName.pipelineAssets
      ? {
          result: { data: [mockAsset, secondMockAsset] },
          query: { isLoading: false, refetch: mocks.refetchAssets },
        }
      : {
          result: { data: [mockOperation] },
          query: { isLoading: false, refetch: mocks.refetchOperations },
        },
  useUpdate: () => ({
    mutateAsync: mocks.updateResource,
    mutation: { isPending: false },
  }),
}));

describe("ComponentsPageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.custom.mockImplementation(({ url }: { url: string }) => {
      if (url === "pipelineAssets/getUsageCount") {
        return Promise.resolve({ data: { count: 2 } });
      }

      return Promise.resolve({
        data: {
          matchedOperations: [
            {
              operationId: mockOperation.id,
              operationName: mockOperation.name,
              reason: "Matches the requested review work.",
            },
          ],
          unmatchedSteps: [],
        },
      });
    });
    mocks.deleteResource.mockResolvedValue({ data: { id: mockAsset.id } });
    mocks.updateResource.mockResolvedValue({ data: mockAsset });
    mocks.refetchAssets.mockResolvedValue(undefined);
    mocks.refetchOperations.mockResolvedValue(undefined);
  });

  it("renders built-in, operation, and pipeline skill sections", () => {
    render(<ComponentsPageContent />);

    expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
    expect(screen.getByText("Folder")).toBeInTheDocument();
    expect(screen.getByText("Review Code")).toBeInTheDocument();
    expect(screen.getByText("Release Review")).toBeInTheDocument();
    expect(screen.getByText("Ran 3 times")).toBeInTheDocument();
  });

  it("filters the library with the search control", async () => {
    const user = userEvent.setup();
    render(<ComponentsPageContent />);

    await user.type(screen.getByRole("textbox", { name: "Search components" }), "release");

    expect(screen.getByText("Release Review")).toBeInTheDocument();
    expect(screen.queryByText("Review Code")).not.toBeInTheDocument();
    expect(screen.queryByText("Folder")).not.toBeInTheDocument();
  });

  it("routes operation edits to the real operation editor", async () => {
    const user = userEvent.setup();
    render(<ComponentsPageContent />);

    await user.click(screen.getByRole("button", { name: "Edit Review Code" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      params: { operationId: mockOperation.id },
      to: "/pipelines/operations/$operationId/edit",
    });
  });

  it("loads asset usage and deletes through the pipeline asset resource", async () => {
    const user = userEvent.setup();
    render(<ComponentsPageContent />);

    await user.click(screen.getByRole("button", { name: "Delete Release Review" }));
    expect(await screen.findByText(/referenced by 2 pipelines/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mocks.deleteResource).toHaveBeenCalledWith({
        resource: ResourceName.pipelineAssets,
        id: mockAsset.id,
      });
    });
    expect(mocks.refetchAssets).toHaveBeenCalled();
  });

  it("ignores a stale usage count after selecting another asset", async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: { data: { count: number } }) => void;
    let resolveSecond!: (value: { data: { count: number } }) => void;
    const firstResponse = new Promise<{ data: { count: number } }>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise<{ data: { count: number } }>((resolve) => {
      resolveSecond = resolve;
    });
    mocks.custom.mockImplementation(({ payload }: { payload: { id: string } }) =>
      payload.id === mockAsset.id ? firstResponse : secondResponse,
    );
    render(<ComponentsPageContent />);

    await user.click(screen.getByRole("button", { name: "Delete Release Review" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Delete Deploy Review" }));

    await act(async () => resolveSecond({ data: { count: 5 } }));
    expect(await screen.findByText(/referenced by 5 pipelines/i)).toBeInTheDocument();

    await act(async () => resolveFirst({ data: { count: 2 } }));
    expect(screen.queryByText(/referenced by 2 pipelines/i)).not.toBeInTheDocument();
    expect(screen.getByText(/referenced by 5 pipelines/i)).toBeInTheDocument();
  });

  it("uses the real intent-analysis endpoint for recommendations", async () => {
    const user = userEvent.setup();
    render(<ComponentsPageContent />);

    await user.click(screen.getByRole("button", { name: "Find for me" }));
    await user.type(
      screen.getByRole("textbox", { name: "Describe the work you need" }),
      "Review a repository before release",
    );
    await user.click(screen.getByRole("button", { name: "Find matching components" }));

    expect(await screen.findByText("Matches the requested review work.")).toBeInTheDocument();
    expect(mocks.custom).toHaveBeenCalledWith({
      url: "pipelines/analyzeIntent",
      method: "post",
      payload: {
        name: "Component recommendation",
        description: "Review a repository before release",
      },
    });
  });
});
