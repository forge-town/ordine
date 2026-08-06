import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AgentContextPayload, WorkspaceCanvasRef } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./Composer";

const context: AgentContextPayload = {
  anchors: [],
  project: { pipelineId: "pipeline-1", pipelineName: "Demo pipeline" },
  selection: [{ label: "Review", refId: "review-node", type: "node" }],
  snapshotIncluded: true,
  threadWindow: { enabled: true, limit: 20 },
};

const refs: WorkspaceCanvasRef[] = [
  {
    baseId: "review-node",
    id: "review-node",
    kind: "operation",
    label: "Review",
    path: [],
    type: "node",
  },
];

const renderComposer = (props: Partial<React.ComponentProps<typeof Composer>> = {}) =>
  render(
    <Composer
      agentContext={context}
      onAttach={vi.fn()}
      onRemoveRef={vi.fn()}
      refs={refs}
      runtimeId="runtime-1"
      {...props}
    />,
  );

describe("Agent Bar Composer", () => {
  it("submits multiline text with current canvas references and clears the draft", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderComposer({ onSubmit });

    const input = screen.getByRole("textbox");
    await user.type(input, "Add a review step");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    await user.type(input, "after transform");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        content: "Add a review step\nafter transform",
        metadata: { attachments: [], referencedNodeIds: ["review-node"] },
      });
      expect(input).toHaveValue("");
    });
  });

  it("uploads through AttachMenu and renders removable attachment chips", async () => {
    const user = userEvent.setup();
    const onAttach = vi
      .fn()
      .mockResolvedValue([{ name: "brief.md", size: 12, type: "text/markdown" }]);
    const onRemoveRef = vi.fn();
    renderComposer({ onAttach, onRemoveRef });

    await user.click(screen.getByTestId("agent-composer-attach-trigger"));
    await waitFor(() =>
      expect(screen.getByTestId("agent-composer-attach-files")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("agent-composer-attach-files"));
    await user.upload(
      screen.getByTestId("agent-composer-file-input"),
      new File(["hello world!"], "brief.md", { type: "text/markdown" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("agent-composer-attachment-chip")).toHaveTextContent("brief.md"),
    );
    expect(onAttach).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId("ref-chip-remove-review-node"));
    expect(onRemoveRef).toHaveBeenCalledWith("review-node");
  });

  it("expands the context strip and keeps the composer controls disabled", async () => {
    const user = userEvent.setup();
    renderComposer({ disabled: true });

    expect(screen.queryByTestId("agent-context-items")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("agent-context-toggle"));
    expect(screen.getByTestId("agent-context-items")).toBeInTheDocument();
    expect(screen.getByTestId("agent-context-item-project")).toHaveAttribute(
      "data-context-on",
      "true",
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByTestId("agent-composer-attach-trigger")).toBeDisabled();
    expect(screen.getByTestId("agent-composer-send")).toBeDisabled();
  });

  it("keeps the draft when the product submit gate rejects the send", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(false);
    renderComposer({ onSubmit });

    const input = screen.getByRole("textbox");
    await user.type(input, "Keep this draft{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(input).toHaveValue("Keep this draft");
  });

  it("keeps session-scoped attachment context visible after a successful send", async () => {
    const user = userEvent.setup();
    renderComposer({
      canRemoveAttachments: false,
      clearAttachmentsOnSubmit: false,
      defaultAttachments: [{ name: "brief.md", size: 12, type: "text/markdown" }],
      onSubmit: vi.fn().mockResolvedValue(true),
    });

    await user.type(screen.getByRole("textbox"), "Use the brief{Enter}");

    const chip = screen.getByTestId("agent-composer-attachment-chip");
    expect(chip).toHaveTextContent("brief.md");
    expect(chip.querySelector("button")).toBeNull();
  });
});
