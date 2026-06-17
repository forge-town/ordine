import { useForm } from "react-hook-form";
import type { Meta, StoryObj } from "@storybook/react";
import { Form } from "@repo/ui/form";
import { PublishConfigFields } from "./PublishConfigFields";
import type { EditFormValues } from "./editFormSchema";

const Demo = ({ target }: { target: "git" | "localDir" }) => {
  const form = useForm<EditFormValues>({
    defaultValues: {
      publishTarget: target,
      repo: target === "git" ? "forge-town/ui-kit" : "~/exports/ui-kit",
      branch: "main",
      subPath: "components/bifrost",
      commitMessage: "Publish generated components",
      openPr: true,
    },
  });

  return (
    <Form {...form}>
      <div className="max-w-md rounded-lg border border-border bg-background p-5">
        <PublishConfigFields control={form.control} />
      </div>
    </Form>
  );
};

const meta: Meta<typeof Demo> = {
  title: "OperationEditPage/PublishConfigFields",
  component: Demo,
};

export default meta;

type Story = StoryObj<typeof Demo>;

export const Git: Story = { args: { target: "git" } };
export const LocalDir: Story = { args: { target: "localDir" } };
