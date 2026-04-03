import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const baseOp: OperationEntity = {
  id: "op_plan",
  name: "Plan",
  description: "Produce a technical implementation plan.",
  category: "planning",
  visibility: "public",
  config: JSON.stringify({ inputs: [], outputs: [] }),
  acceptedObjectTypes: ["file"],
  createdAt: 1712000000000,
  updatedAt: 1712000000000,
};

describe("OperationDetailPageContent – visibility", () => {
  it("shows 'public' visibility badge for public operations", () => {
    render(<OperationDetailPageContent operation={baseOp} />);
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  it("shows 'private' visibility badge for private operations", () => {
    render(
      <OperationDetailPageContent
        operation={{ ...baseOp, visibility: "private" }}
      />,
    );
    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("shows 'team' visibility badge for team operations", () => {
    render(
      <OperationDetailPageContent
        operation={{ ...baseOp, visibility: "team" }}
      />,
    );
    expect(screen.getByText("team")).toBeInTheDocument();
  });
});
