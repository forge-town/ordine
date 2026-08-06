import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VersionMenu } from "./VersionMenu";

vi.mock("@repo/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/scroll-area", () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

describe("VersionMenu", () => {
  it("only overwrites dirty graphs and can save a new version", async () => {
    const user = userEvent.setup();
    const handleOverwrite = vi.fn();
    const handleSaveAsNew = vi.fn();
    const { rerender } = render(
      <VersionMenu
        dirty={false}
        runState="draft"
        version={3}
        onOverwrite={handleOverwrite}
        onSaveAsNew={handleSaveAsNew}
      />,
    );

    expect(screen.getByTestId("canvas-v2-version-overwrite")).toBeDisabled();
    rerender(
      <VersionMenu
        dirty
        runState="running"
        version={3}
        onOverwrite={handleOverwrite}
        onSaveAsNew={handleSaveAsNew}
      />,
    );
    await user.click(screen.getByTestId("canvas-v2-version-overwrite"));
    await user.click(screen.getByTestId("canvas-v2-version-save-as-new"));

    expect(handleOverwrite).toHaveBeenCalledOnce();
    expect(handleSaveAsNew).toHaveBeenCalledOnce();
  });
});
