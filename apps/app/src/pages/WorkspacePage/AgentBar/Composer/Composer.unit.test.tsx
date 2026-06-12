import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceCanvasRef } from "../../_store/workspaceStore";
import { useAgentBarStore } from "../_store";
import { Composer } from "./Composer";

const refs: WorkspaceCanvasRef[] = [
  { baseId: "node-1", id: "node-1", kind: "file", label: "Source File", path: [], type: "node" },
  { baseId: "edge-1", id: "edge-1", kind: "semantic", label: "Parse edge", path: [], type: "edge" },
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

    expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
  });

  it("sends a message with referenced nodes on Enter", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(screen.getByRole("textbox", { name: "消息" }), "Make it harder{Enter}");

    expect(useAgentBarStore.getState().messages).toEqual([
      expect.objectContaining({
        content: "Make it harder",
        metadata: expect.objectContaining({
          referencedNodeIds: ["node-1", "edge-1"],
        }),
        role: "user",
      }),
    ]);
    expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("");
  });

  it("keeps Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.type(
      screen.getByRole("textbox", { name: "消息" }),
      "Line one{Shift>}{Enter}{/Shift}",
    );

    expect(useAgentBarStore.getState().messages).toEqual([]);
    expect(screen.getByRole("textbox", { name: "消息" })).toHaveValue("Line one\n");
  });

  it("removes reference tags", async () => {
    const user = userEvent.setup();
    const handleRemoveRef = vi.fn();
    renderComposer(handleRemoveRef);

    await user.click(screen.getByRole("button", { name: "移除 Source File" }));

    expect(handleRemoveRef).toHaveBeenCalledWith("node-1");
  });

  it("stores selected attachment names in metadata", async () => {
    const user = userEvent.setup();
    renderComposer();

    const input = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(input).toBeTruthy();

    await user.upload(input!, new File(["sample"], "sample.pdf", { type: "application/pdf" }));
    await user.type(screen.getByRole("textbox", { name: "消息" }), "Use this sample{Enter}");

    expect(useAgentBarStore.getState().messages[0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attachments: [{ name: "sample.pdf", type: "application/pdf" }],
        }),
      }),
    );
  });

  it("appends folder uploads with relative paths instead of replacing attachments", async () => {
    const user = userEvent.setup();
    renderComposer();

    const fileInput = document.querySelector<HTMLInputElement>(
      "[data-testid='agent-composer-file-input']",
    );
    const folderInput = document.querySelector<HTMLInputElement>(
      "[data-testid='agent-composer-folder-input']",
    );
    expect(fileInput).toBeTruthy();
    expect(folderInput).toBeTruthy();

    await user.upload(fileInput!, new File(["sample"], "sample.pdf", { type: "application/pdf" }));
    const folderFile = new File(["readme"], "readme.md", { type: "text/markdown" });
    Object.defineProperty(folderFile, "webkitRelativePath", { value: "docs/readme.md" });
    await user.upload(folderInput!, folderFile);
    await user.type(screen.getByRole("textbox", { name: "消息" }), "Use these{Enter}");

    expect(useAgentBarStore.getState().messages[0]).toEqual(
      expect.objectContaining({
        metadata: expect.objectContaining({
          attachments: [
            { name: "sample.pdf", type: "application/pdf" },
            { name: "docs/readme.md", type: "text/markdown" },
          ],
        }),
      }),
    );
  });

  it("submits an attachment-only reverse engineering request", async () => {
    const user = userEvent.setup();
    renderComposer();

    const input = document.querySelector<HTMLInputElement>("input[type='file']");
    expect(input).toBeTruthy();

    await user.upload(input!, new File(["sample"], "finished.csv", { type: "text/csv" }));
    await user.click(screen.getByRole("button", { name: "发送" }));

    expect(useAgentBarStore.getState().messages[0]).toEqual(
      expect.objectContaining({
        content: "根据附件样本逆向生成 Pipeline：finished.csv",
        metadata: expect.objectContaining({
          attachments: [{ name: "finished.csv", type: "text/csv" }],
        }),
      }),
    );
  });
});
