import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import type { OperationEntity } from "@repo/models";

const mockUseLoaderData = vi.fn();

vi.mock("@/routes/_layout/operations.$operationId.index", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const baseOp: OperationEntity = {
  id: "op_plan",
  name: "Plan",
  description: "Produce a technical implementation plan.",
  config: JSON.stringify({
    executor: { type: "script", command: "eslint src/", language: "bash" },
    inputs: [],
    outputs: [],
  }),
  acceptedObjectTypes: ["file"],
  createdAt: 1_712_000_000_000,
  updatedAt: 1_712_000_000_000,
};

describe("OperationDetailPageContent – executor display", () => {
  it("shows executor section when config has an executor", () => {
    mockUseLoaderData.mockReturnValue(baseOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText(/执行方式/i)).toBeInTheDocument();
  });

  it("shows script command when executor type is script", () => {
    mockUseLoaderData.mockReturnValue(baseOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("eslint src/")).toBeInTheDocument();
  });

  it("shows skill id when executor type is skill", () => {
    const op: OperationEntity = {
      ...baseOp,
      config: JSON.stringify({
        executor: { type: "skill", skillId: "lint-check" },
        inputs: [],
        outputs: [],
      }),
    };
    mockUseLoaderData.mockReturnValue(op);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("lint-check")).toBeInTheDocument();
  });

  it("shows prompt text when executor type is prompt", () => {
    const op: OperationEntity = {
      ...baseOp,
      config: JSON.stringify({
        executor: { type: "prompt", prompt: "You are a code reviewer" },
        inputs: [],
        outputs: [],
      }),
    };
    mockUseLoaderData.mockReturnValue(op);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("You are a code reviewer")).toBeInTheDocument();
  });

  it("does not render a visibility badge", () => {
    mockUseLoaderData.mockReturnValue(baseOp);
    render(<OperationDetailPageContent />);
    expect(screen.queryByText("public")).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
    expect(screen.queryByText("team")).not.toBeInTheDocument();
  });
});
