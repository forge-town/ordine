import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessCanvasStoreProvider } from "../_store";
import { PromptNode } from "./PromptNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "test",
  useUpdateNodeInternals: () => () => undefined,
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    query: {
      data: { data: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
    },
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>{children}</HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "prompt" as const,
  label: "My Prompt",
  prompt: "Please analyze the code",
};

describe("PromptNode", () => {
  it("renders label", () => {
    render(<PromptNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("My Prompt")).toBeInTheDocument();
  });

  it("renders prompt text in textarea", () => {
    render(<PromptNode data={baseData} id="test" />, { wrapper });
    expect(screen.getByDisplayValue("Please analyze the code")).toBeInTheDocument();
  });

  it("shows placeholder when prompt is empty", () => {
    render(<PromptNode data={{ ...baseData, prompt: "" }} id="test" />, { wrapper });
    expect(screen.getByPlaceholderText("Enter prompt text...")).toBeInTheDocument();
  });
});
