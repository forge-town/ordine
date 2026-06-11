import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { ContextStrip } from "./ContextStrip";

const ref: WorkspaceCanvasRef = {
  baseId: "node-1",
  id: "node-1",
  kind: "operation",
  label: "Generate quiz",
  path: [],
  type: "node",
};

describe("ContextStrip", () => {
  it("collapses by default and expands with the item list", async () => {
    const user = userEvent.setup();
    render(<ContextStrip phase="applied" refs={[]} />);

    expect(screen.queryByTestId("agent-context-items")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("agent-context-toggle"));
    expect(screen.getByTestId("agent-context-items")).toBeInTheDocument();
  });

  it("lights the selection item when refs are present", async () => {
    const user = userEvent.setup();
    render(<ContextStrip phase="applied" refs={[ref]} />);

    await user.click(screen.getByTestId("agent-context-toggle"));

    expect(screen.getByText(/Generate quiz/)).toBeInTheDocument();
  });

  it("prioritizes run-time items while running", () => {
    render(<ContextStrip phase="running" refs={[]} />);

    expect(screen.getByText(/优先运行 \+ 节点状态/)).toBeInTheDocument();
  });

  it("counts annotations when anchors exist", async () => {
    const user = userEvent.setup();
    render(<ContextStrip anchorCount={3} phase="applied" refs={[]} />);

    await user.click(screen.getByTestId("agent-context-toggle"));

    expect(screen.getByText(/画布批注 · 3/)).toBeInTheDocument();
  });
});
