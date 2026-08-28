import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@repo/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { render } from "../test/test-wrapper";

describe("Animate UI overlay adaptation", () => {
  it("keeps Dialog semantics while animating its lifecycle", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger render={<Button>Open dialog</Button>} />
        <DialogContent>
          <DialogTitle>Animated dialog</DialogTitle>
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Animated dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("preserves Popover trigger and outside-dismiss behavior", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger render={<Button>Filters</Button>} />
        <PopoverContent>Popover body</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const content = await screen.findByText("Popover body");
    await waitFor(() => expect(content).toBeVisible());

    await user.click(document.body);
    await waitFor(() => expect(screen.queryByText("Popover body")).not.toBeInTheDocument());
  });

  it("opens Select repeatedly without losing the selected value", async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="one">
        <SelectTrigger aria-label="Choice">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">One</SelectItem>
          <SelectItem value="two">Two</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Choice" });
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Two" }));
    expect(trigger).toHaveTextContent("two");

    await user.click(trigger);
    expect(await screen.findByRole("option", { name: "Two" })).toBeVisible();
  });
});
