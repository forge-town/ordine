import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HarnessCanvasStoreProvider } from "../_store";
import { QuickAddButton } from "./QuickAddButton";

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>{children}</HarnessCanvasStoreProvider>
);

describe("QuickAddButton", () => {
  it("renders without crashing", () => {
    const { container } = render(<QuickAddButton nodeId="node-1" nodeType="code-file" />, {
      wrapper,
    });
    expect(container.firstChild).toBeTruthy();
  });
});
