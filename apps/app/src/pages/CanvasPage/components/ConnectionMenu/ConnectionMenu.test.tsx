import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { ConnectionMenu } from "./ConnectionMenu";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

describe("ConnectionMenu", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ConnectionMenu
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
