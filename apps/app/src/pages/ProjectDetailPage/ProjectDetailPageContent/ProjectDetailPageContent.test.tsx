import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectDetailPageContent } from "./ProjectDetailPageContent";

vi.mock("@/routes/projects.$projectId", () => ({
  Route: {
    useLoaderData: () => ({
      project: null,
      works: [],
      pipelines: [],
    }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

describe("ProjectDetailPageContent", () => {
  it("shows not found message when project is null", () => {
    render(<ProjectDetailPageContent />);
    expect(screen.getByText("项目不存在")).toBeInTheDocument();
  });
});
