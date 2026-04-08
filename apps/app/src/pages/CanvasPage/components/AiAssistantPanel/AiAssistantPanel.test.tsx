import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../../_store";
import { AiAssistantPanel } from "./AiAssistantPanel";

vi.stubGlobal("fetch", vi.fn());

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>{children}</HarnessCanvasStoreProvider>
);

describe("AiAssistantPanel", () => {
  it("renders without crashing", () => {
    render(<AiAssistantPanel />, { wrapper });
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});
