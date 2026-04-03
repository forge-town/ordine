import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import type { OperationEntity } from "@/models/daos/operationsDao";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const mockOp: OperationEntity = {
  id: "op_plan",
  name: "Plan",
  description: "Produce a technical implementation plan.",
  category: "planning",
  visibility: "public",
  config: JSON.stringify({
    inputs: [
      {
        name: "specDocument",
        kind: "file",
        required: true,
        description: "The spec.md that defines what to build.",
      },
      {
        name: "techStack",
        kind: "text",
        required: false,
        description: "Technology stack choices.",
      },
    ],
    outputs: [
      {
        name: "planDocument",
        kind: "file",
        path: ".specify/{feature}/plan.md",
        description: "Technical plan document.",
      },
    ],
  }),
  acceptedObjectTypes: ["file"],
  createdAt: 1_712_000_000_000,
  updatedAt: 1_712_000_000_000,
};

describe("OperationDetailPageContent", () => {
  it("renders the operation name in the header", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("renders the operation id", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("op_plan")).toBeInTheDocument();
  });

  it("renders the category badge", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("planning")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(
      screen.getByText("Produce a technical implementation plan."),
    ).toBeInTheDocument();
  });

  it("renders the inputs section with port names", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("specDocument")).toBeInTheDocument();
    expect(screen.getByText("techStack")).toBeInTheDocument();
  });

  it("marks required inputs as required", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("必填")).toBeInTheDocument();
  });

  it("renders the outputs section with port names", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText("planDocument")).toBeInTheDocument();
  });

  it("renders output path", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    expect(screen.getByText(".specify/{feature}/plan.md")).toBeInTheDocument();
  });

  it("renders accepted object types", () => {
    render(<OperationDetailPageContent operation={mockOp} />);
    // "file" appears in acceptedObjectTypes chip and also in port kind badges
    const matches = screen.getAllByText("file");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows not-found state when operation is null", () => {
    render(<OperationDetailPageContent operation={null} />);
    expect(screen.getByText("Operation 不存在")).toBeInTheDocument();
  });
});
