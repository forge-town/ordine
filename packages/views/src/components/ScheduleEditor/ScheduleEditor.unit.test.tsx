import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Routine } from "@repo/schemas";
import { ScheduleEditor } from "./ScheduleEditor";

const { createRoutine, deleteRoutine, updateRoutine } = vi.hoisted(() => ({
  createRoutine: vi.fn(),
  deleteRoutine: vi.fn(),
  updateRoutine: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutate: createRoutine, mutation: { isPending: false } }),
  useDelete: () => ({ mutate: deleteRoutine, mutation: { isPending: false } }),
  useUpdate: () => ({ mutate: updateRoutine, mutation: { isPending: false } }),
}));

const routine: Routine = {
  createdAt: new Date("2026-08-05T00:00:00.000Z"),
  cronExpression: "0 6 * * *",
  description: null,
  enabled: true,
  id: "routine-1",
  inputConfig: null,
  lastRunAt: null,
  name: "Repo changelog",
  nextRunAt: null,
  pipelineId: "pipeline-1",
  updatedAt: new Date("2026-08-05T00:00:00.000Z"),
};

beforeEach(() => {
  createRoutine.mockReset();
  deleteRoutine.mockReset();
  updateRoutine.mockReset();
});

describe("ScheduleEditor", () => {
  it("creates a valid routine from a visual cron preset", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo changelog"
        onClose={handleClose}
      />,
    );

    await user.click(screen.getByTestId("schedule-preset-weekdays"));
    await user.click(screen.getByTestId("schedule-save"));

    expect(createRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "routines",
        values: expect.objectContaining({
          cronExpression: "0 9 * * 1-5",
          enabled: true,
          pipelineId: "pipeline-1",
        }),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(handleClose).not.toHaveBeenCalled();

    const [, options] = createRoutine.mock.calls[0] as [unknown, { onSuccess: () => void }];
    options.onSuccess();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid cron input before mutation", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo changelog"
        onClose={handleClose}
      />,
    );

    const minute = screen.getByTestId("schedule-cron-minute");
    await user.clear(minute);
    await user.type(minute, "invalid");
    await user.click(screen.getByTestId("schedule-save"));

    expect(createRoutine).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Cron");
  });

  it("updates and deletes an existing routine", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo changelog"
        routine={routine}
        onClose={handleClose}
      />,
    );

    await user.click(screen.getByTestId("schedule-save"));
    await user.click(screen.getByTestId("schedule-delete"));

    expect(updateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({ id: "routine-1", resource: "routines" }),
      expect.any(Object),
    );
    expect(deleteRoutine).toHaveBeenCalledWith(
      expect.objectContaining({ id: "routine-1", resource: "routines" }),
      expect.any(Object),
    );
  });
});
