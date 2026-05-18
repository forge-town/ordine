import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@repo/schemas";
import { AgentsDataTable } from "./AgentsDataTable";

const mockNavigate = vi.fn();
const mockUseOne = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", () => ({
  useOne: (...args: unknown[]) => mockUseOne(...args),
}));

const makeAgent = (id: string, name: string): Agent => ({
  id,
  name,
  description: `${name} description`,
  defaultRuntime: "codex",
  systemPrompt: "",
  capabilities: [{ name: "code", description: "Writes code" }],
  allowedTools: ["shell"],
  allowedSkillIds: [],
  tags: ["dev"],
  meta: { createdAt: new Date(1000), updatedAt: new Date(1000) },
});

describe("AgentsDataTable", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseOne.mockClear();
  });

  it("renders row data without refetching each agent cell", () => {
    render(<AgentsDataTable data={[makeAgent("agent-1", "Codex Agent")]} />);

    expect(screen.getByText("Codex Agent")).toBeInTheDocument();
    expect(screen.getByText("Codex Agent description")).toBeInTheDocument();
    expect(mockUseOne).not.toHaveBeenCalled();
  });
});
