import { describe, it, expect, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

vi.mock("@/routes/_layout/projects.$projectId.workspace", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
    useParams: () => ({ projectId: "proj-1" }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ProjectWorkspacePage", () => {
  it("renders without crashing", () => {
    render(<ProjectWorkspacePage />);
    expect(document.body).toBeTruthy();
  });
});
