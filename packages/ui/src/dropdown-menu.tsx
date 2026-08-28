"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "./lib/utils";
import {
  AnimatePresence,
  MotionHighlight,
  m,
  useControlledState,
  useDataAttribute,
  type Transition,
} from "./lib/motion";
import { ChevronRightIcon, CheckIcon } from "lucide-react";

type MenuContextValue = {
  isOpen: boolean;
};

const DropdownMenuContext = React.createContext<MenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu content must be used within DropdownMenu");
  }

  return context;
}

function DropdownMenu({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: MenuPrimitive.Root.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <DropdownMenuContext.Provider value={{ isOpen }}>
      <MenuPrimitive.Root
        data-slot="dropdown-menu"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuPortal({
  children,
  ...props
}: Omit<MenuPrimitive.Portal.Props, "keepMounted">) {
  const { isOpen } = useDropdownMenuContext();

  return (
    <AnimatePresence>
      {isOpen && (
        <MenuPrimitive.Portal data-slot="dropdown-menu-portal" keepMounted {...props}>
          {children}
        </MenuPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  transition = { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
  children,
  ...props
}: Omit<MenuPrimitive.Popup.Props, "render"> &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset"> & {
    transition?: Transition;
  }) {
  return (
    <DropdownMenuPortal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
            className,
          )}
          render={
            <m.div
              data-slot="dropdown-menu-content"
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
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </DropdownMenuPortal>
  );
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-1.5 py-1 text-xs font-medium text-muted-foreground data-inset:pl-7",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <MenuPrimitive.Item
      ref={itemRef}
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "group/dropdown-menu-item isolate relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=destructive]:*:[svg]:text-destructive",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
    </MenuPrimitive.Item>
  );
}

function DropdownMenuSub({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: MenuPrimitive.SubmenuRoot.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <DropdownMenuContext.Provider value={{ isOpen }}>
      <MenuPrimitive.SubmenuRoot
        data-slot="dropdown-menu-sub"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <MenuPrimitive.SubmenuTrigger
      ref={itemRef}
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-inset:pl-7 data-popup-open:bg-accent data-popup-open:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">
        {children}
        <ChevronRightIcon className="ml-auto" />
      </span>
    </MenuPrimitive.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "w-auto min-w-[96px] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className,
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  inset,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <MenuPrimitive.CheckboxItem
      ref={itemRef}
      data-slot="dropdown-menu-checkbox-item"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      <span
        className="pointer-events-none absolute right-2 z-10 flex items-center justify-center"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  inset,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  inset?: boolean;
}) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataAttribute(itemRef, "data-highlighted");

  return (
    <MenuPrimitive.RadioItem
      ref={itemRef}
      data-slot="dropdown-menu-radio-item"
      data-inset={inset}
      className={cn(
        "isolate relative flex cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground data-inset:pl-7 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <MotionHighlight visible={highlighted} />
      <span className="relative z-10 flex min-w-0 flex-1 items-center gap-1.5">{children}</span>
      <span
        className="pointer-events-none absolute right-2 z-10 flex items-center justify-center"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground group-focus/dropdown-menu-item:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
