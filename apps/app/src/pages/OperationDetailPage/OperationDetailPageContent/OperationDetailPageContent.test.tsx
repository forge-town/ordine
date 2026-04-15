import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import type { OperationRecord } from "@repo/db-schema";

const mockUseLoaderData = vi.fn();

vi.mock("@/routes/_layout/operations.$operationId.index", () => ({
  Route: { useLoaderData: () => mockUseLoaderData() },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const mockOp: OperationRecord = {
  id: "op_plan",
  name: "Plan",
  description: "Produce a technical implementation plan.",
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
  createdAt: new Date(1_712_000_000_000),
  updatedAt: new Date(1_712_000_000_000),
};

describe("OperationDetailPageContent", () => {
  it("renders the operation name in the header", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("renders the operation id", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("op_plan")).toBeInTheDocument();
  });

  it("renders the description", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("Produce a technical implementation plan.")).toBeInTheDocument();
  });

  it("renders the inputs section with port names", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("specDocument")).toBeInTheDocument();
    expect(screen.getByText("techStack")).toBeInTheDocument();
  });

  it("marks required inputs as required", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("必填")).toBeInTheDocument();
  });

  it("renders the outputs section with port names", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("planDocument")).toBeInTheDocument();
  });

  it("renders output path", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText(".specify/{feature}/plan.md")).toBeInTheDocument();
  });

  it("renders accepted object types", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    // "file" appears in acceptedObjectTypes chip and also in port kind badges
    const matches = screen.getAllByText("file");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows not-found state when operation is null", () => {
    mockUseLoaderData.mockReturnValue(null);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("Operation 不存在")).toBeInTheDocument();
  });
});
