import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Operation, PipelineData } from "@repo/schemas";
import { PipelineDetailPageContent } from "./PipelineDetailPageContent";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({
    children,
    to,
    search,
    ...props
  }: React.PropsWithChildren<
    {
      to?: string;
      search?: Record<string, unknown>;
    } & Record<string, unknown>
  >) => {
    const href = search
      ? `${to ?? "#"}?${new URLSearchParams(Object.entries(search).map(([k, v]) => [k, String(v)])).toString()}`
      : (to ?? "#");

    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock("@/routes/_layout/pipelines.$pipelineId", () => ({
  Route: {
    useParams: () => ({ pipelineId: "pipe-1" }),
  },
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: React.PropsWithChildren) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const makeOp = (id: string, name: string, description?: string): Operation => ({
  id,
  name,
  description: description ?? "",
  config: { inputs: [], outputs: [] },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
});

const makePipeline = (overrides: Partial<PipelineData> = {}): PipelineData => {
  const { timeoutMs = null, ...rest } = overrides;

  return {
    id: "pipe-1",
    name: "My Pipeline",
    description: "A test pipeline",
    tags: [],
    nodes: [],
    edges: [],
    timeoutMs,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...rest,
  };
};

const ops: Operation[] = [
  makeOp("op-lint", "Run ESLint", "Lint the source code"),
  makeOp("op-build", "Build Project", "Compile the project"),
  makeOp("op-deploy", "Deploy", "Deploy to production"),
];

const mockUseOne = vi.fn();
const mockUseList = vi.fn();
const mockUseCustomMutation = vi.fn();

vi.mock("@refinedev/core", () => ({
  useOne: (...args: unknown[]) => mockUseOne(...args),
  useList: (...args: unknown[]) => mockUseList(...args),
  useCustomMutation: () => mockUseCustomMutation(),
}));

describe("PipelineDetailPageContent", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockUseOne.mockReturnValue({
      result: makePipeline(),
      query: { isLoading: false, data: { data: makePipeline() } },
    });
    mockUseList.mockReturnValue({
      result: { data: ops, total: ops.length },
      query: { isLoading: false, data: { data: ops, total: ops.length } },
    });
    mockUseCustomMutation.mockReturnValue({ mutate: vi.fn() });
  });

  it("renders the pipeline name in the header", () => {
    render(<PipelineDetailPageContent />);
    expect(screen.getByRole("heading", { name: "My Pipeline" })).toBeInTheDocument();
  });

  it("renders the pipeline description", () => {
    render(<PipelineDetailPageContent />);
    expect(screen.getByText("A test pipeline")).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    mockUseOne.mockReturnValue({
      result: makePipeline({ tags: ["ci", "lint"] }),
      query: { isLoading: false, data: { data: makePipeline({ tags: ["ci", "lint"] }) } },
    });
    render(<PipelineDetailPageContent />);
    expect(screen.getByText("ci")).toBeInTheDocument();
    expect(screen.getByText("lint")).toBeInTheDocument();
  });

  it("renders node count stat", () => {
    mockUseOne.mockReturnValue({
      result: makePipeline({
        nodes: [
          {
            id: "n1",
            type: "operation",
            position: { x: 0, y: 0 },
            data: {
              label: "Step",
              nodeType: "operation",
              operationId: "op-lint",
              operationName: "Run ESLint",
              status: "idle",
            },
          },
        ],
      }),
      query: {
        isLoading: false,
        data: {
          data: makePipeline({
            nodes: [
              {
                id: "n1",
                type: "operation",
                position: { x: 0, y: 0 },
                data: {
                  label: "Step",
                  nodeType: "operation",
                  operationId: "op-lint",
                  operationName: "Run ESLint",
                  status: "idle",
                },
              },
            ],
          }),
        },
      },
    });
    render(<PipelineDetailPageContent />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders a canvas preview area", () => {
    render(<PipelineDetailPageContent />);
    expect(screen.getByTestId("canvas-preview")).toBeInTheDocument();
  });

  it("clicking canvas preview navigates to canvas with pipeline id", async () => {
    const user = userEvent.setup();
    render(<PipelineDetailPageContent />);
    await user.click(screen.getByTestId("canvas-preview"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/canvas",
      search: { id: "pipe-1" },
    });
  });

  it("has a link button to open in canvas", () => {
    render(<PipelineDetailPageContent />);
    const link = screen.getByRole("link", { name: /在 Canvas 中编辑/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain("pipe-1");
  });

  it("shows empty state message inside canvas area when no nodes", () => {
    render(<PipelineDetailPageContent />);
    expect(screen.getByText(/还没有操作步骤/i)).toBeInTheDocument();
  });
});
