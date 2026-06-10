import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceCanvasRef } from "../../_store/workspaceStore";
import { useAgentBarStore } from "../_store";
import { Composer } from "./Composer";

const refs: WorkspaceCanvasRef[] = [
  { id: "node-1", label: "Source File", type: "node" },
  { id: "edge-1", label: "Parse edge", type: "edge" },
];

const renderComposer = (handleRemoveRef = vi.fn()) => {
  render(<Composer refs={refs} onRemoveRef={handleRemoveRef} />);

  return { handleRemoveRef };
};

describe("Composer", () => {
  beforeEach(() => {
    useAgentBarStore.getState().resetAgentBar();
  });

  it("disables send for empty messages", () => {
    renderComposer();

    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("sends a message with referenced nodes on Enter", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Make it harder{Enter}");

    expect(useAgentBarStore.getState().messages).toEqual([
      expect.objectContaining({
        content: "Make it harder",
        metadata: expect.objectContaining({
          referencedNodeIds: ["node-1", "edge-1"],
        }),
        role: "user",
      }),
    ]);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
  });

  it("keeps Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(
      screen.getByRole("textbox", { name: "Message" }),
      "Line one{Shift>}{Enter}{/Shift}",
    );

    expect(useAgentBarStore.getState().messages).toEqual([]);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Line one\n");
  });

  it("removes reference tags", async () => {
    const user = userEvent.setup();
    const handleRemoveRef = vi.fn();
    renderComposer(handleRemoveRef);

    await user.click(screen.getByRole("button", { name: "Remove Source File" }));

    expect(handleRemoveRef).toHaveBeenCalledWith("node-1");
  });

  it("stores selected attachment names in metadata", async () => {
    const user = userEvent.setup();
    renderComposer();

    const input = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(input).toBeTruthy();

    await user.upload(input!, new File(["sample"], "sample.pdf", { type: "application/pdf" }));
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Use this sample{Enter}");

    expect(useAgentBarStore.getState().messages[0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attachments: [{ name: "sample.pdf" }],
        }),
      }),
    );
  });
});
