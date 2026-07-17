import { render } from "../../test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPage } from "./CanvasPage";

vi.mock("../../components/CanvasLayout", () => ({
  CanvasLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-layout">{children}</div>
  ),
}));

vi.mock("./CanvasPageContent", () => ({
  CanvasPageContent: () => <div data-testid="canvas-page-content" />,
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@refinedev/core")>()),
  useOne: () => ({
    result: null,
    query: { isLoading: false },
  }),
}));

describe("CanvasPage", () => {
  it("renders inside CanvasLayout", () => {
    render(<CanvasPage id="test-id" />);
    expect(screen.getByTestId("canvas-layout")).toBeInTheDocument();
  });

  it("renders CanvasPageContent", () => {
    render(<CanvasPage id="test-id" />);
    expect(screen.getByTestId("canvas-page-content")).toBeInTheDocument();
  });
});
