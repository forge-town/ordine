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
  it("only saves dirty graphs without presenting synthetic history", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const { rerender } = render(
      <VersionMenu dirty={false} runState="draft" version={3} onSave={handleSave} />,
    );

    expect(screen.getByTestId("canvas-v2-version-overwrite")).toBeDisabled();
    rerender(<VersionMenu dirty runState="running" version={3} onSave={handleSave} />);
    await user.click(screen.getByTestId("canvas-v2-version-overwrite"));

    expect(handleSave).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("canvas-v2-version-save-as-new")).not.toBeInTheDocument();
    expect(screen.queryByText("History")).not.toBeInTheDocument();
  });
});
