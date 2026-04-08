import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CanvasInner } from "./CanvasInner";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    ReactFlow: ({ children }: React.PropsWithChildren) => (
      <div data-testid="react-flow">{children}</div>
    ),
  };
});

vi.mock("@/services/pipelinesService", () => ({
  updatePipeline: vi.fn(),
}));

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

describe("CanvasInner", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasInner />, { wrapper });
    expect(container.firstChild).toBeTruthy();
  });
});
