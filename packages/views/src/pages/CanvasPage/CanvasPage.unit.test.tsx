import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasPage } from "./CanvasPage";

const { useOne } = vi.hoisted(() => ({ useOne: vi.fn() }));
vi.mock("@refinedev/core", () => ({ useOne }));
vi.mock("../../components/CanvasLayout", () => ({
  CanvasLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas-layout">{children}</div>
  ),
}));
vi.mock("../../components/PageLoadingState", () => ({
  PageLoadingState: () => <div>正在读取</div>,
}));
vi.mock("./_store", () => ({
  CanvasPageStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./AgentControlBridge", () => ({ CanvasAgentControlBridge: () => null }));
vi.mock("./CanvasPageContent", () => ({
  CanvasPageContent: () => <div data-testid="canvas-page-content" />,
}));
vi.mock("./CanvasPublishedPipeline", () => ({
  CanvasPublishedPipeline: ({ id }: { id: string }) => (
    <div data-testid="published-fallback">{id}</div>
  ),
}));

beforeEach(() => useOne.mockReset());
describe("CanvasPage authoring boundary", () => {
  it("keeps a new route in the original CanvasLayout", () => {
    useOne.mockReturnValue({ result: undefined, query: { isPending: true } });
    render(<CanvasPage />);
    expect(screen.getByTestId("canvas-layout")).toContainElement(
      screen.getByTestId("canvas-page-content"),
    );
  });
  it("keeps an existing author draft in the original editor", () => {
    useOne.mockReturnValue({ result: { id: "draft" }, query: { isSuccess: true } });
    render(<CanvasPage id="draft" />);
    expect(screen.getByTestId("canvas-page-content")).toBeInTheDocument();
    expect(screen.queryByTestId("published-fallback")).not.toBeInTheDocument();
  });
  it("waits for the author query before trying execution", () => {
    useOne.mockReturnValue({ query: { isPending: true } });
    render(<CanvasPage id="canonical" />);
    expect(screen.getByText("正在读取")).toBeInTheDocument();
    expect(screen.queryByTestId("published-fallback")).not.toBeInTheDocument();
  });
  it.each([
    { result: null, query: { isSuccess: true } },
    { query: { isSuccess: true, data: { data: null } } },
    { query: { error: { statusCode: 404, message: "missing" } } },
    { query: { error: { data: { httpStatus: 404 }, message: "missing" } } },
  ])("falls back only with explicit author absence %#", (response) => {
    useOne.mockReturnValue(response);
    render(<CanvasPage id="canonical" />);
    expect(screen.getByTestId("canvas-layout")).toContainElement(
      screen.getByTestId("published-fallback"),
    );
    expect(screen.getByTestId("published-fallback")).toHaveTextContent("canonical");
    expect(screen.queryByTestId("canvas-page-content")).not.toBeInTheDocument();
  });
  it.each([
    { statusCode: 401, message: "404 in unrelated text" },
    { statusCode: 500, message: "internal failure" },
    { message: "404 Not found" },
  ])("does not reinterpret errors as missing author data %#", (error) => {
    useOne.mockReturnValue({ result: null, query: { error } });
    render(<CanvasPage id="canonical" />);
    expect(screen.getByText("无法读取作者草稿")).toBeInTheDocument();
    expect(screen.queryByTestId("published-fallback")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-page-content")).not.toBeInTheDocument();
  });
  it("does not treat an undefined successful response as explicit absence", () => {
    useOne.mockReturnValue({ query: { isSuccess: true } });
    render(<CanvasPage id="canonical" />);
    expect(screen.getByText("无法读取作者草稿")).toBeInTheDocument();
    expect(screen.queryByTestId("published-fallback")).not.toBeInTheDocument();
  });
});
