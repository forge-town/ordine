import type { Meta, StoryObj } from "@storybook/react";
import type { JobStatus } from "./types";
import { StatusIcon } from "./StatusIcon";

const statuses: JobStatus[] = ["queued", "running", "done", "failed", "cancelled", "expired"];

const meta: Meta<typeof StatusIcon> = {
  title: "CanvasPage/RunConsole/StatusIcon",
  component: StatusIcon,
  tags: ["autodocs"],
  args: {
    status: "running",
  },
  argTypes: {
    status: {
      control: "select",
      options: statuses,
    },
  },
  parameters: {
    docs: {
      description: {
        component: "Compact icon used by the run console to represent job status.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusIcon>;

export const Running: Story = {
  parameters: {
    docs: {
      description: {
        story: "Single running-state icon with spinner animation.",
      },
    },
  },
};

export const Matrix: Story = {
  render: () => (
    <div className="flex items-center gap-4 p-4">
      {statuses.map((status) => (
        <div key={status} className="flex items-center gap-1 text-xs">
          <StatusIcon status={status} />
          <span>{status}</span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All job statuses shown together for visual comparison.",
      },
    },
  },
};
