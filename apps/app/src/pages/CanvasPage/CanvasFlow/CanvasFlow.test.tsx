import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasFlow } from "./CanvasFlow";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    ReactFlow: ({ children }: React.PropsWithChildren) => (
      <div data-testid="react-flow">{children}</div>
    ),
  };
});

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

describe("CanvasFlow", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasFlow />, { wrapper });
    expect(container.firstChild).toBeTruthy();
  });
});
