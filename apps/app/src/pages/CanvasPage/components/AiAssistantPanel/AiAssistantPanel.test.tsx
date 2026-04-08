import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { AiAssistantPanel } from "./AiAssistantPanel";

vi.stubGlobal("fetch", vi.fn());

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

describe("AiAssistantPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<AiAssistantPanel />, { wrapper });
    expect(container).toBeTruthy();
  });
});
