import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { Form } from "@repo/ui/form";
import { PublishConfigFields } from "./PublishConfigFields";
import type { EditFormValues } from "./editFormSchema";

const Harness = () => {
  const form = useForm<EditFormValues>({
    defaultValues: {
      publishTarget: "git",
      repo: "",
      branch: "",
      subPath: "",
      commitMessage: "",
      openPr: true,
    },
  });

  return (
    <Form {...form}>
      <PublishConfigFields control={form.control} />
    </Form>
  );
};

describe("PublishConfigFields", () => {
  it("renders all publish config controls with stable testids", () => {
    render(<Harness />);
    expect(screen.getByTestId("publish-config")).toBeInTheDocument();
    for (const id of ["target", "repo", "branch", "subPath", "commitMessage", "openPr"]) {
      expect(screen.getByTestId(`publish-config-${id}`)).toBeInTheDocument();
    }
  });

  it("toggles the openPr switch", async () => {
    render(<Harness />);
    const toggle = screen.getByTestId("publish-config-openPr");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("accepts typed input into the repo field", async () => {
    render(<Harness />);
    const repo = screen.getByTestId("publish-config-repo");
    await userEvent.type(repo, "forge-town/ui-kit");
    expect(repo).toHaveValue("forge-town/ui-kit");
  });
});
