import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { ProjectDetailPageContent } from "./ProjectDetailPageContent";

vi.mock("@/routes/_layout/projects.$projectId.index", () => ({
  Route: {
    useParams: () => ({ projectId: "proj-1" }),
    useLoaderData: () => ({
      project: null,
      pipelines: [],
    }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    query: { isLoading: false },
  }),
  useOne: () => ({
    result: null,
    query: { isLoading: false },
  }),
}));

describe("ProjectDetailPageContent", () => {
  it("shows not found message when project is null", () => {
    render(<ProjectDetailPageContent />);
    expect(screen.getByText("项目不存在")).toBeInTheDocument();
  });
});
