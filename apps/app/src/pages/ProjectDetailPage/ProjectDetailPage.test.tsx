import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ProjectDetailPage } from "./ProjectDetailPage";

vi.mock("@/routes/_layout/projects.$projectId", () => ({
  Route: {
    useLoaderData: () => ({ project: null, works: [], pipelines: [] }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ProjectDetailPage", () => {
  it("renders without crashing", () => {
    render(<ProjectDetailPage />);
    expect(document.body).toBeTruthy();
  });
});
