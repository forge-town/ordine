import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectDetailPageContent } from "./ProjectDetailPageContent";

vi.mock("@/routes/_layout/projects.$projectId.index", () => ({
  Route: {
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

describe("ProjectDetailPageContent", () => {
  it("shows not found message when project is null", () => {
    render(<ProjectDetailPageContent />);
    expect(screen.getByText("项目不存在")).toBeInTheDocument();
  });
});
