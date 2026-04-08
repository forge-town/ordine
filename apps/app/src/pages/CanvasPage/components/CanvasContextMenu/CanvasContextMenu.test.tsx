import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CanvasContextMenu } from "./CanvasContextMenu";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

describe("CanvasContextMenu", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <CanvasContextMenu
        flowX={100}
        flowY={100}
        screenX={200}
        screenY={200}
        onClose={vi.fn()}
      />,
      { wrapper },
    );
    expect(container.firstChild).toBeTruthy();
  });
});
