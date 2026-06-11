import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VersionMenu } from "./VersionMenu";

describe("VersionMenu", () => {
  it("disables overwrite when the graph is clean", async () => {
    const user = userEvent.setup();
    const onOverwrite = vi.fn();
    render(
      <VersionMenu
        dirty={false}
        runState="draft"
        version={3}
        onOverwrite={onOverwrite}
        onSaveAsNew={vi.fn()}
      />,
    );

    await user.click(screen.getByTestId("canvas-v2-version-menu-trigger"));
    await user.click(screen.getByTestId("canvas-v2-version-overwrite"));

    expect(onOverwrite).not.toHaveBeenCalled();
  });

  it("shows the unsaved marker and fires overwrite when dirty", async () => {
    const user = userEvent.setup();
    const onOverwrite = vi.fn();
    render(
      <VersionMenu
        dirty
        runState="draft"
        version={3}
        onOverwrite={onOverwrite}
        onSaveAsNew={vi.fn()}
      />,
    );

    expect(screen.getByTestId("canvas-v2-version-menu-trigger").textContent).toContain("v3");
    await user.click(screen.getByTestId("canvas-v2-version-menu-trigger"));
    await user.click(screen.getByTestId("canvas-v2-version-overwrite"));

    expect(onOverwrite).toHaveBeenCalledTimes(1);
  });

  it("saves as the next version", async () => {
    const user = userEvent.setup();
    const onSaveAsNew = vi.fn();
    render(
      <VersionMenu
        dirty
        runState="running"
        version={2}
        onOverwrite={vi.fn()}
        onSaveAsNew={onSaveAsNew}
      />,
    );

    await user.click(screen.getByTestId("canvas-v2-version-menu-trigger"));
    await user.click(screen.getByTestId("canvas-v2-version-save-as-new"));

    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });
});
