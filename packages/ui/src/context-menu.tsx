"use client";

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "./lib/utils";
import {
  AnimatePresence,
  MotionHighlight,
  m,
  useControlledState,
  useDataAttribute,
  type Transition,
} from "./lib/motion";

type MenuContextValue = {
  isOpen: boolean;
};

const ContextMenuContext = React.createContext<MenuContextValue | null>(null);

function useContextMenuContext() {
  const context = React.useContext(ContextMenuContext);
  if (!context) {
    throw new Error("ContextMenu content must be used within ContextMenu");
  }

  return context;
}

function ContextMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ContextMenuPrimitive.Root.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <ContextMenuContext.Provider value={{ isOpen }}>
      <ContextMenuPrimitive.Root
        data-slot="context-menu"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </ContextMenuContext.Provider>
  );
}

function ContextMenuPortal({
  children,
  ...props
}: Omit<ContextMenuPrimitive.Portal.Props, "keepMounted">) {
  const { isOpen } = useContextMenuContext();

  return (
    <AnimatePresence>
      {isOpen && (
        <ContextMenuPrimitive.Portal data-slot="context-menu-portal" keepMounted {...props}>
          {children}
        </ContextMenuPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

function ContextMenuTrigger({ className, ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      className={cn("select-none", className)}
      {...props}
    />
  );
}

function ContextMenuContent({
  className,
  align = "start",
  alignOffset = 4,
  side = "right",
  sideOffset = 0,
  anchor,
  positionMethod,
  transition = { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
  children,
  ...props
}: Omit<ContextMenuPrimitive.Popup.Props, "render"> & {
  transition?: Transition;
} & Pick<
    ContextMenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "anchor" | "positionMethod"
  >) {
  return (
    <ContextMenuPortal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        anchor={anchor}
        positionMethod={positionMethod}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          render={
            <m.div
              data-slot="context-menu-content"
              initial={{ opacity: 0, transform: "scale(0.95)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              exit={{ opacity: 0, transform: "scale(0.95)" }}
              transition={transition}
              style={{ willChange: "opacity, transform" }}
            />
          }
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPortal>
  );
}

function ContextMenuGroup({ ...props }: ContextMenuPrimitive.Group.Props) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: ContextMenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className,
      )}
      {...props}
    />
  );
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  children,
  ...props
}: ContextMenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <ContextMenuPrimitive.Item
      ref={itemRef}
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus:*:[svg]:text-accent-foreground data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
    </ContextMenuPrimitive.Item>
  );
}

function ContextMenuSub({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: ContextMenuPrimitive.SubmenuRoot.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <ContextMenuContext.Provider value={{ isOpen }}>
      <ContextMenuPrimitive.SubmenuRoot
        data-slot="context-menu-sub"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </ContextMenuContext.Provider>
  );
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <ContextMenuPrimitive.SubmenuTrigger
      ref={itemRef}
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
        {children}
        <ChevronRightIcon className="cn-rtl-flip ml-auto" />
      </span>
    </ContextMenuPrimitive.SubmenuTrigger>
  );
}

function ContextMenuSubContent({ ...props }: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      className="shadow-lg"
      side="right"
      {...props}
    />
  );
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: ContextMenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <ContextMenuPrimitive.CheckboxItem
      ref={itemRef}
      data-slot="context-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      <span className="pointer-events-none absolute right-2 z-10">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
    </ContextMenuPrimitive.CheckboxItem>
  );
}

function ContextMenuRadioGroup({ ...props }: ContextMenuPrimitive.RadioGroup.Props) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />;
}

function ContextMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: ContextMenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <ContextMenuPrimitive.RadioItem
      ref={itemRef}
      data-slot="context-menu-radio-item"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      <span className="pointer-events-none absolute right-2 z-10">
        <ContextMenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
    </ContextMenuPrimitive.RadioItem>
  );
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function ContextMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/context-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
