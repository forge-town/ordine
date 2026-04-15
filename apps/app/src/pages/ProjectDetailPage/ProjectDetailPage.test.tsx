import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("@/routes/_layout/projects.$projectId.index", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  useNavigate: () => vi.fn(),
}));

describe("ProjectDetailPage", () => {
  it("renders without crashing", () => {
    render(<ProjectDetailPage />);
    expect(document.body).toBeTruthy();
  });
});
