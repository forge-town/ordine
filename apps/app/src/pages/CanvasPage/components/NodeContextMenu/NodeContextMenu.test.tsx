import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { NodeContextMenu } from "./NodeContextMenu";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>{children}</HarnessCanvasStoreProvider>
);

describe("NodeContextMenu", () => {
  it("renders without crashing", () => {
    const handleClose = vi.fn();
    const { container } = render(
      <NodeContextMenu nodeId="node-1" screenX={200} screenY={200} onClose={handleClose} />,
      { wrapper }
    );
    expect(container.firstChild).toBeTruthy();
  });
});
