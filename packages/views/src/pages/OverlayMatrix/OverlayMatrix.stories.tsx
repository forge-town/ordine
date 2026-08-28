import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@repo/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@repo/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@repo/ui/context-menu";

const meta = {
  title: "UI/Overlay Matrix",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function OverlayControls() {
  const [selected, setSelected] = React.useState("one");

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-6 text-foreground sm:p-10">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold">Dialog and Sheet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Modal focus management and directional drawer motion.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger render={<Button>Open dialog</Button>} />
                <DialogContent>
                  <DialogTitle>Overlay dialog</DialogTitle>
                  <DialogDescription>Escape and outside press remain available.</DialogDescription>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline">Nested popover</Button>} />
                    <PopoverContent>Nested content</PopoverContent>
                  </Popover>
                </DialogContent>
              </Dialog>
              <Sheet>
                <SheetTrigger render={<Button variant="outline">Open sheet</Button>} />
                <SheetContent>
                  <SheetTitle>Right sheet</SheetTitle>
                  <SheetDescription>Slides from the trigger side.</SheetDescription>
                </SheetContent>
              </Sheet>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold">Anchored overlays</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Popover, tooltip, menu, context menu, and select share the trigger origin.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost">Hover tooltip</Button>} />
                <TooltipContent>Tooltip content</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline">Open menu</Button>} />
                <DropdownMenuContent>
                  <DropdownMenuItem>First action</DropdownMenuItem>
                  <DropdownMenuItem>Second action</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select value={selected} onValueChange={(value) => setSelected(value)}>
                <SelectTrigger aria-label="Overlay select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one">One</SelectItem>
                  <SelectItem value="two">Two</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ContextMenu>
              <ContextMenuTrigger className="mt-4 flex min-h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                Right-click this area
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem>Context action</ContextMenuItem>
                <ContextMenuItem>Another action</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </section>

          <section className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-2">
            <h2 className="font-heading text-base font-semibold">Scroll and theme coverage</h2>
            <div className="mt-4 grid gap-3 overflow-y-auto rounded-lg bg-muted/40 p-4 sm:max-h-64 sm:grid-cols-2">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="rounded-md border bg-background p-3 text-sm">
                  Scroll item {index + 1}
                </div>
              ))}
            </div>
            <div className="dark mt-4 rounded-xl bg-background p-4 text-foreground">
              <p className="text-sm">Dark theme smoke check</p>
              <Popover>
                <PopoverTrigger render={<Button variant="outline">Dark popover</Button>} />
                <PopoverContent>Dark content</PopoverContent>
              </Popover>
            </div>
          </section>
        </div>
      </div>
    </TooltipProvider>
  );
}

export const Default: Story = {
  render: () => <OverlayControls />,
};
