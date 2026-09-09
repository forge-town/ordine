import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionJobCard } from "./ExecutionJobCard";

const fixtures = vi.hoisted(() => ({
  refetch: vi.fn(async () => ({})),
  mutate: vi.fn(async () => ({ data: {} })),
  job: { id: "job", state: "waiting_for_input", error: null },
  page: [
    {
      sequence: 1,
      jobId: "job",
      nodeId: "node-checkpoint",
      type: "node_state",
      payload: { state: "waiting_for_input" },
      attemptId: null,
      createdAt: "2026-09-08T00:00:00Z",
    },
  ],
}));
vi.mock("@refinedev/core", () => ({
  useOne: ({ resource }: { resource: string }) => ({
    result: resource === "jobs" ? fixtures.job : { artifacts: [], outputs: null },
    query: { refetch: fixtures.refetch },
  }),
  useList: ({ meta }: { meta: { afterSequence: number } }) => ({
    result: { data: meta.afterSequence === 0 ? fixtures.page : [] },
    query: { refetch: fixtures.refetch },
  }),
  useCreate: () => ({ mutateAsync: fixtures.mutate }),
}));
describe("ExecutionJobCard checkpoints", () => {
  it("acknowledges the exact waiting node through named execution without creating another run", async () => {
    render(<ExecutionJobCard jobId="job" />);
    const acknowledge = await screen.findByRole("button", { name: "确认继续 · node-checkpoint" });
    fireEvent.click(acknowledge);
    fireEvent.click(acknowledge);
    await waitFor(() => expect(fixtures.mutate).toHaveBeenCalledOnce());
    expect(fixtures.mutate).toHaveBeenCalledWith({
      dataProviderName: "execution",
      resource: "checkpoint-ack",
      values: { jobId: "job", nodeId: "node-checkpoint" },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "确认继续 · node-checkpoint" }),
      ).not.toBeInTheDocument(),
    );
  });
});
