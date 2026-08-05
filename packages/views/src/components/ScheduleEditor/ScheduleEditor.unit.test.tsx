import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

const secondRoutine: Routine = {
  ...routine,
  cronExpression: "0 9 * * 1-5",
  id: "routine-2",
  name: "Weekday changelog",
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

  it("preserves a disabled routine without a Cron expression", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo changelog"
        routine={{ ...routine, cronExpression: null, enabled: false }}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("schedule-save"));

    expect(updateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "routine-1",
        values: expect.objectContaining({ cronExpression: null, enabled: false }),
      }),
      expect.any(Object),
    );
  });

  it("makes every pipeline routine selectable and editable", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo changelog"
        routines={[routine, secondRoutine]}
        onClose={vi.fn()}
      />,
    );

    const select = screen.getByTestId("schedule-routine-select");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.selectOptions(select, "routine-2");
    await user.click(screen.getByTestId("schedule-save"));

    expect(updateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "routine-2",
        values: expect.objectContaining({ cronExpression: "0 9 * * 1-5" }),
      }),
      expect.any(Object),
    );
  });

  it("selects an existing routine when asynchronously loaded", async () => {
    const user = userEvent.setup();
    const props = {
      onClose: vi.fn(),
      pipelineId: "pipeline-1",
      pipelineName: "Repo changelog",
    };
    const { rerender } = render(<ScheduleEditor {...props} routines={[]} />);

    rerender(<ScheduleEditor {...props} routines={[routine]} />);

    await waitFor(() =>
      expect(screen.getByTestId("schedule-routine-select")).toHaveValue("routine-1"),
    );
    await user.click(screen.getByTestId("schedule-save"));

    expect(updateRoutine).toHaveBeenCalledWith(
      expect.objectContaining({ id: "routine-1" }),
      expect.any(Object),
    );
    expect(createRoutine).not.toHaveBeenCalled();
  });

  it("does not create a routine when the selected routine disappears", async () => {
    const user = userEvent.setup();
    const props = {
      onClose: vi.fn(),
      pipelineId: "pipeline-1",
      pipelineName: "Repo changelog",
    };
    const { rerender } = render(<ScheduleEditor {...props} routines={[routine]} />);

    rerender(<ScheduleEditor {...props} routines={[]} />);
    await user.click(screen.getByTestId("schedule-save"));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(createRoutine).not.toHaveBeenCalled();
    expect(updateRoutine).not.toHaveBeenCalled();
  });
});
