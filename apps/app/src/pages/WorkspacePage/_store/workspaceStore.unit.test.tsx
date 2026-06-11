import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createWorkspaceStore, useWorkspaceStore, WorkspaceStoreProvider } from "./workspaceStore";

const Probe = () => {
  const phase = useWorkspaceStore((state) => state.phase);
  const pipelineId = useWorkspaceStore((state) => state.pipelineId);
  const setPhase = useWorkspaceStore((state) => state.setPhase);
  const handleClick = () => setPhase("running");

  return (
    <button type="button" onClick={handleClick}>
      {pipelineId}:{phase}
    </button>
  );
};

describe("workspaceStore", () => {
  it("creates isolated stores per pipeline", () => {
    const storeA = createWorkspaceStore("pipeline-a");
    const storeB = createWorkspaceStore("pipeline-b");

    storeA.getState().setPhase("running");

    expect(storeA.getState().pipelineId).toBe("pipeline-a");
    expect(storeA.getState().phase).toBe("running");
    expect(storeB.getState().pipelineId).toBe("pipeline-b");
    expect(storeB.getState().phase).toBe("empty");
  });

  it("keeps the default store compatibility helpers", () => {
    useWorkspaceStore.getState().resetWorkspace();
    useWorkspaceStore.getState().setCompOpen(false);

    expect(useWorkspaceStore.getState().compOpen).toBe(false);
    useWorkspaceStore.getState().resetWorkspace();
    expect(useWorkspaceStore.getState().compOpen).toBe(true);
  });

  it("provides a pipeline-scoped store through context", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WorkspaceStoreProvider pipelineId="pipeline-a">
        <Probe />
      </WorkspaceStoreProvider>,
    );

    expect(screen.getByRole("button", { name: "pipeline-a:empty" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "pipeline-a:empty" }));
    expect(screen.getByRole("button", { name: "pipeline-a:running" })).toBeInTheDocument();

    rerender(
      <WorkspaceStoreProvider pipelineId="pipeline-b">
        <Probe />
      </WorkspaceStoreProvider>,
    );

    expect(screen.getByRole("button", { name: "pipeline-b:empty" })).toBeInTheDocument();
  });
});
