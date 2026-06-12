import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AgentContextPayload } from "@repo/schemas";
import { ContextStrip } from "./ContextStrip";

const baseContext: AgentContextPayload = {
  anchors: [],
  project: { pipelineId: "pipeline-1", pipelineName: "Demo" },
  selection: [],
  snapshotIncluded: true,
  threadWindow: { enabled: false, limit: 20 },
};

describe("ContextStrip", () => {
  it("collapses by default and expands with the item list", async () => {
    const user = userEvent.setup();
    render(<ContextStrip context={baseContext} />);

    expect(screen.queryByTestId("agent-context-items")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("agent-context-toggle"));
    expect(screen.getByTestId("agent-context-items")).toBeInTheDocument();
  });

  it("lights the selection item when the payload carries a selection", async () => {
    const user = userEvent.setup();
    render(
      <ContextStrip
        context={{
          ...baseContext,
          selection: [{ label: "Generate quiz", refId: "node-1", type: "node" }],
        }}
      />,
    );

    await user.click(screen.getByTestId("agent-context-toggle"));

    expect(screen.getByText(/Generate quiz/)).toBeInTheDocument();
    expect(screen.getByTestId("agent-context-item-selection")).toHaveAttribute(
      "data-context-on",
      "true",
    );
  });

  it("keeps selection and annotations off when the payload omits them", async () => {
    const user = userEvent.setup();
    render(<ContextStrip context={baseContext} />);

    await user.click(screen.getByTestId("agent-context-toggle"));

    expect(screen.getByTestId("agent-context-item-selection")).toHaveAttribute(
      "data-context-on",
      "false",
    );
    expect(screen.getByTestId("agent-context-item-annotations")).toHaveAttribute(
      "data-context-on",
      "false",
    );
    expect(screen.getByTestId("agent-context-item-runState")).toHaveAttribute(
      "data-context-on",
      "false",
    );
    // memory 未实现：永远不点亮（手册决策 5）。
    expect(screen.getByTestId("agent-context-item-memory")).toHaveAttribute(
      "data-context-on",
      "false",
    );
  });

  it("prioritizes run-time items when runState is live", () => {
    render(
      <ContextStrip
        context={{
          ...baseContext,
          runState: { jobId: "job-1", nodeStatuses: { "node-1": "running" }, status: "running" },
        }}
      />,
    );

    expect(screen.getByText(/优先运行 \+ 节点状态/)).toBeInTheDocument();
  });

  it("counts annotations from payload anchors", async () => {
    const user = userEvent.setup();
    render(
      <ContextStrip
        context={{
          ...baseContext,
          anchors: [
            { count: 2, label: "Parse", refId: "node-1" },
            { count: 1, label: "Export", refId: "node-2" },
          ],
        }}
      />,
    );

    await user.click(screen.getByTestId("agent-context-toggle"));

    expect(screen.getByText(/画布批注 · 3/)).toBeInTheDocument();
  });
});
