import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Pages/ProjectDetailPage",
  parameters: {
    docs: {
      description: {
        component:
          "This page uses Route.useParams() and requires a live TanStack Router context. View it in the running app at /projects/:projectId.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-sm text-muted-foreground">
      This page component uses Route.useParams() and requires a live TanStack Router context to
      render. Please view it in the running app.
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
