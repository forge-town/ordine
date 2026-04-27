import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperationDetailPageContent } from "./OperationDetailPageContent";
import type { Operation } from "@repo/schemas";

const mockUseLoaderData = vi.fn();

vi.mock("@/routes/_layout/operations.$operationId.index", () => ({
  Route: {
    useLoaderData: () => mockUseLoaderData(),
    useParams: () => ({ operationId: "op_plan" }),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: { data: [], total: 0 },
    data: { data: [], total: 0 },
    isLoading: false,
    isError: false,
  }),
  useDelete: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCreate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdate: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useInvalidate: () => vi.fn(),
  useOne: () => ({ result: mockUseLoaderData(), isLoading: false }),
}));

const mockOp: Operation = {
  id: "op_plan",
  name: "Plan",
  description: "Produce a technical implementation plan.",
  config: {
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
  },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(1_712_000_000_000), updatedAt: new Date(1_712_000_000_000) },
};

describe("OperationDetailPageContent", () => {
  it("renders the operation name in the header", () => {
    mockUseLoaderData.mockReturnValue(mockOp);
    render(<OperationDetailPageContent />);
    expect(screen.getByText("Plan")).toBeInTheDocument();
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

  describe("executor display", () => {
    const executorOp: Operation = {
      id: "op_plan",
      name: "Plan",
      description: "Produce a technical implementation plan.",
      config: {
        executor: { type: "script", command: "eslint src/", language: "bash" },
        inputs: [],
        outputs: [],
      },
      acceptedObjectTypes: ["file"],
      meta: { createdAt: new Date(1_712_000_000_000), updatedAt: new Date(1_712_000_000_000) },
    };

    it("shows executor section when config has an executor", () => {
      mockUseLoaderData.mockReturnValue(executorOp);
      render(<OperationDetailPageContent />);
      expect(screen.getByText(/执行方式/i)).toBeInTheDocument();
    });

    it("shows script command when executor type is script", () => {
      mockUseLoaderData.mockReturnValue(executorOp);
      render(<OperationDetailPageContent />);
      expect(screen.getByText("eslint src/")).toBeInTheDocument();
    });

    it("shows skill id when executor type is skill", () => {
      const op: Operation = {
        ...executorOp,
        config: {
          executor: { type: "agent", agentMode: "skill", skillId: "lint-check" },
          inputs: [],
          outputs: [],
        },
      };
      mockUseLoaderData.mockReturnValue(op);
      render(<OperationDetailPageContent />);
      expect(screen.getByText("lint-check")).toBeInTheDocument();
    });

    it("shows prompt text when executor type is prompt", () => {
      const op: Operation = {
        ...executorOp,
        config: {
          executor: { type: "agent", agentMode: "prompt", prompt: "You are a code reviewer" },
          inputs: [],
          outputs: [],
        },
      };
      mockUseLoaderData.mockReturnValue(op);
      render(<OperationDetailPageContent />);
      expect(screen.getByText("You are a code reviewer")).toBeInTheDocument();
    });

    it("does not render a visibility badge", () => {
      mockUseLoaderData.mockReturnValue(executorOp);
      render(<OperationDetailPageContent />);
      expect(screen.queryByText("public")).not.toBeInTheDocument();
      expect(screen.queryByText("private")).not.toBeInTheDocument();
      expect(screen.queryByText("team")).not.toBeInTheDocument();
    });
  });
});
