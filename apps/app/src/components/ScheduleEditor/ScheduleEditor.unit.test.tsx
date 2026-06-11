import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Routine } from "@repo/schemas";
import { ScheduleEditor } from "./ScheduleEditor";

const createMock = vi.fn();
const updateMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutate: createMock }),
  useDelete: () => ({ mutate: deleteMock }),
  useUpdate: () => ({ mutate: updateMock }),
}));

const routine: Routine = {
  createdAt: new Date(),
  cronExpression: "0 6 * * *",
  enabled: true,
  eventConfig: null,
  eventType: null,
  id: "routine-1",
  inputConfig: null,
  lastRunAt: null,
  name: "Repo → Changelog",
  nextRunAt: null,
  pipelineId: "pipeline-1",
  triggerType: "cron",
  updatedAt: new Date(),
};

describe("ScheduleEditor", () => {
  beforeEach(() => {
    createMock.mockReset();
    updateMock.mockReset();
    deleteMock.mockReset();
  });

  it("creates a cron routine from a preset", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ScheduleEditor pipelineId="pipeline-1" pipelineName="Repo → Changelog" onClose={onClose} />,
    );

    await user.click(screen.getByTestId("schedule-trigger-cron"));
    await user.click(screen.getByTestId("schedule-preset-weekdays"));
    await user.click(screen.getByTestId("schedule-save"));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          cronExpression: "0 9 * * 1-5",
          pipelineId: "pipeline-1",
          triggerType: "cron",
        }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("creates an event routine", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleEditor pipelineId="pipeline-1" pipelineName="Triage" onClose={vi.fn()} />,
    );

    await user.click(screen.getByTestId("schedule-trigger-event"));
    await user.click(screen.getByTestId("schedule-event-pr.opened"));
    await user.click(screen.getByTestId("schedule-save"));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ eventType: "pr.opened", triggerType: "event" }),
      }),
    );
  });

  it("updates an existing routine and can delete it", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo → Changelog"
        routine={routine}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("schedule-save"));
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "routine-1" }),
    );

    await user.click(screen.getByTestId("schedule-delete"));
    expect(deleteMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "routine-1" }),
    );
  });

  it("removes the standing routine when switched back to manual", async () => {
    const user = userEvent.setup();
    render(
      <ScheduleEditor
        pipelineId="pipeline-1"
        pipelineName="Repo → Changelog"
        routine={routine}
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("schedule-trigger-manual"));
    await user.click(screen.getByTestId("schedule-save"));

    expect(deleteMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
