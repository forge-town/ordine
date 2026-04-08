import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProjectWorkspacePage } from "./ProjectWorkspacePage";

vi.mock("@/routes/_layout/projects.$projectId.workspace", () => ({
  Route: {
    useLoaderData: () => ({ project: null, pipelines: [] }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/services/worksService", () => ({
  createWork: vi.fn().mockResolvedValue({}),
}));

describe("ProjectWorkspacePage", () => {
  it("renders without crashing", () => {
    render(<ProjectWorkspacePage />);
    expect(document.body).toBeTruthy();
  });
});
