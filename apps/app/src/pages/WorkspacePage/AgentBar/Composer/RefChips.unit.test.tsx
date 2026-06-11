import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { RefChips } from "./RefChips";

const ref: WorkspaceCanvasRef = {
  baseId: "node-1",
  id: "node-1",
  kind: "operation",
  label: "Generate quiz",
  path: [],
  type: "node",
};

describe("RefChips", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
  });

  it("highlights the canvas target on hover", async () => {
    const user = userEvent.setup();
    render(<RefChips refs={[ref]} />);

    await user.hover(screen.getByTestId("ref-chip-node-1"));
    expect(useWorkspaceStore.getState().hoverRefId).toBe("node-1");

    await user.unhover(screen.getByTestId("ref-chip-node-1"));
    expect(useWorkspaceStore.getState().hoverRefId).toBeNull();
  });

  it("requests a spotlight on click", async () => {
    const user = userEvent.setup();
    render(<RefChips refs={[ref]} />);

    await user.click(screen.getByTestId("ref-chip-node-1"));

    expect(useWorkspaceStore.getState().spotlight?.ref.baseId).toBe("node-1");
  });

  it("removes a chip without triggering the spotlight", async () => {
    const user = userEvent.setup();
    const removed: string[] = [];
    render(<RefChips refs={[ref]} onRemoveRef={(id) => removed.push(id)} />);

    await user.click(screen.getByTestId("ref-chip-remove-node-1"));

    expect(removed).toEqual(["node-1"]);
    expect(useWorkspaceStore.getState().spotlight).toBeNull();
  });
});
