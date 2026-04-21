import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("@/routes/_layout/projects.$projectId.index", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
    useParams: () => ({ projectId: "proj-1" }),
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
