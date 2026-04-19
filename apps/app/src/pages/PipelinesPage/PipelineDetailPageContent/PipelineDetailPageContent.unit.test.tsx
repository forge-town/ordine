import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineDetailPageContent } from "./PipelineDetailPageContent";
import type { PipelineEntity } from "@repo/models";
import type { OperationRecord } from "@repo/db-schema";

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

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: React.PropsWithChildren) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const makeOp = (id: string, name: string, description?: string): OperationRecord => ({
  id,
  name,
  description: description ?? null,
  config: "{}",
  acceptedObjectTypes: ["file"],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makePipeline = (overrides: Partial<PipelineEntity> = {}): PipelineEntity => {
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

const ops: OperationRecord[] = [
  makeOp("op-lint", "Run ESLint", "Lint the source code"),
  makeOp("op-build", "Build Project", "Compile the project"),
  makeOp("op-deploy", "Deploy", "Deploy to production"),
];

describe("PipelineDetailPageContent", () => {
  it("renders the pipeline name in the header", () => {
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline()} />);
    expect(screen.getByRole("heading", { name: "My Pipeline" })).toBeInTheDocument();
  });

  it("renders the pipeline description", () => {
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline()} />);
    expect(screen.getByText("A test pipeline")).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    render(
      <PipelineDetailPageContent
        operations={ops}
        pipeline={makePipeline({ tags: ["ci", "lint"] })}
      />
    );
    expect(screen.getByText("ci")).toBeInTheDocument();
    expect(screen.getByText("lint")).toBeInTheDocument();
  });

  it("renders node count stat", () => {
    const pipeline = makePipeline({
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
    });
    render(<PipelineDetailPageContent operations={ops} pipeline={pipeline} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders a canvas preview area", () => {
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline()} />);
    expect(screen.getByTestId("canvas-preview")).toBeInTheDocument();
  });

  it("clicking canvas preview navigates to canvas with pipeline id", async () => {
    const user = userEvent.setup();
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline()} />);
    await user.click(screen.getByTestId("canvas-preview"));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/canvas",
      search: { id: "pipe-1" },
    });
  });

  it("has a link button to open in canvas", () => {
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline()} />);
    const link = screen.getByRole("link", { name: /在 Canvas 中编辑/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toContain("pipe-1");
  });

  it("shows empty state message inside canvas area when no nodes", () => {
    render(<PipelineDetailPageContent operations={ops} pipeline={makePipeline({ nodes: [] })} />);
    expect(screen.getByText(/还没有操作步骤/i)).toBeInTheDocument();
  });
});
