import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPage } from "./CanvasPage";

vi.mock("@/routes/canvas", () => ({
  Route: {
    useLoaderData: () => ({
      pipeline: null,
      operations: [],
      recipes: [],
      bestPractices: [],
    }),
    useSearch: () => ({ id: "test-id" }),
  },
}));

vi.mock("@/components/CanvasLayout", () => ({
  CanvasLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-layout">{children}</div>
  ),
}));

vi.mock("./CanvasPageContent", () => ({
  CanvasPageContent: () => <div data-testid="canvas-page-content" />,
}));

describe("CanvasPage", () => {
  it("renders inside CanvasLayout", () => {
    render(<CanvasPage />);
    expect(screen.getByTestId("canvas-layout")).toBeInTheDocument();
  });

  it("renders CanvasPageContent", () => {
    render(<CanvasPage />);
    expect(screen.getByTestId("canvas-page-content")).toBeInTheDocument();
  });
});
