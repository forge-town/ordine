import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AgentContextPayload } from "@repo/schemas";
import { ContextStrip } from "./ContextStrip";

const baseContext: AgentContextPayload = {
  anchors: [],
  project: { pipelineId: "pipeline-1", pipelineName: "Demo pipeline" },
  selection: [],
  snapshotIncluded: true,
  threadWindow: { enabled: false, limit: 20 },
};

describe("ContextStrip", () => {
  it("shows the real pipeline and selected Canvas items", async () => {
    const user = userEvent.setup();
    render(
      <ContextStrip
        context={{
          ...baseContext,
          selection: [{ label: "Review", refId: "review-node", type: "node" }],
        }}
      />,
    );

    const toggle = screen.getByTestId("agent-context-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Demo pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/Review/)).toBeInTheDocument();
    expect(screen.getByTestId("agent-context-item-selection")).toHaveAttribute(
      "data-context-on",
      "true",
    );
  });

  it("can render an expanded acceptance state", () => {
    render(<ContextStrip context={baseContext} defaultOpen />);

    expect(screen.getByTestId("agent-context-items")).toBeInTheDocument();
    expect(screen.getByTestId("agent-context-item-project")).toHaveAttribute(
      "data-context-on",
      "true",
    );
    expect(screen.getByTestId("agent-context-item-selection")).toHaveAttribute(
      "data-context-on",
      "false",
    );
  });
});
