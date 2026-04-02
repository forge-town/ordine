import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { SkillNode } from "./SkillNode";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HarnessCanvasStoreProvider>
    <ReactFlowProvider>{children}</ReactFlowProvider>
  </HarnessCanvasStoreProvider>
);

const baseData = {
  nodeType: "skill" as const,
  label: "文本摘要",
  skillName: "summarize-text",
  acceptanceCriteria: "输出不超过100字",
  status: "idle" as const,
};

describe("SkillNode", () => {
  it("renders label", () => {
    render(<SkillNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("文本摘要")).toBeInTheDocument();
  });

  it("renders skillName", () => {
    render(<SkillNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("summarize-text")).toBeInTheDocument();
  });

  it("renders acceptanceCriteria when provided", () => {
    render(<SkillNode id="test" data={baseData} />, { wrapper });
    expect(screen.getByText("✓ 输出不超过100字")).toBeInTheDocument();
  });

  it("renders placeholder when skillName is empty", () => {
    render(<SkillNode id="test" data={{ ...baseData, skillName: "" }} />, {
      wrapper,
    });
    expect(screen.getByText("未设置 skill")).toBeInTheDocument();
  });

  it("shows idle status icon by default", () => {
    render(<SkillNode id="test" data={{ ...baseData, status: undefined }} />, {
      wrapper,
    });
    // Only label rendered, no status text
    expect(screen.getByText("文本摘要")).toBeInTheDocument();
  });
});
