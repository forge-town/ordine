"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "./lib/utils";
import { AnimatePresence, m, useControlledState, type Transition } from "./lib/motion";

const PopoverContext = React.createContext<boolean | null>(null);

function usePopoverOpen() {
  const open = React.useContext(PopoverContext);
  if (open === null) {
    throw new Error("PopoverContent must be used within Popover");
  }

  return open;
}

function Popover({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: PopoverPrimitive.Root.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <PopoverContext.Provider value={isOpen}>
      <PopoverPrimitive.Root
        data-slot="popover"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  transition = { type: "spring", stiffness: 300, damping: 25 },
  ...props
}: Omit<PopoverPrimitive.Popup.Props, "render"> & {
  transition?: Transition;
} & Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const isOpen = usePopoverOpen();

  return (
    <AnimatePresence>
      {isOpen && (
        <PopoverPrimitive.Portal keepMounted>
          <PopoverPrimitive.Positioner
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            className="isolate z-50"
          >
            <PopoverPrimitive.Popup
              data-slot="popover-content"
              className={cn(
                "z-50 w-72 origin-(--transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
                className,
              )}
              render={
                <m.div
                  data-slot="popover-content"
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
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
