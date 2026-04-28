import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "JobDetailPage/JobDetailPageContent",
  parameters: {
    docs: {
      description: {
        component:
          "This component depends on Route.useParams() from TanStack Router and requires a live router match. View it in the running app at /jobs/:jobId.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-sm text-muted-foreground">
      This component uses Route.useParams() and requires a live TanStack Router context to render.
      Please view it in the running app.
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
