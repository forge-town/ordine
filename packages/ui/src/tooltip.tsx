"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "./lib/utils";
import { AnimatePresence, m, useControlledState, type Transition } from "./lib/motion";

const TooltipContext = React.createContext<boolean | null>(null);

function useTooltipOpen() {
  const open = React.useContext(TooltipContext);
  if (open === null) {
    throw new Error("TooltipContent must be used within Tooltip");
  }

  return open;
}

function TooltipProvider({ delay = 0, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />;
}

function Tooltip({
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: TooltipPrimitive.Root.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <TooltipContext.Provider value={isOpen}>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  children,
  transition = { duration: 0.125, ease: [0.23, 1, 0.32, 1] },
  ...props
}: Omit<TooltipPrimitive.Popup.Props, "render"> & {
  transition?: Transition;
} & Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  const isOpen = useTooltipOpen();

  return (
    <AnimatePresence>
      {isOpen && (
        <TooltipPrimitive.Portal keepMounted>
          <TooltipPrimitive.Positioner
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            className="isolate z-50"
          >
            <TooltipPrimitive.Popup
              data-slot="tooltip-content"
              className={cn(
                "z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background has-data-[slot=kbd]:pr-1.5 **:data-[slot=kbd]:relative **:data-[slot=kbd]:isolate **:data-[slot=kbd]:z-50 **:data-[slot=kbd]:rounded-sm",
                className,
              )}
              render={
                <m.div
                  data-slot="tooltip-content"
                  initial={{ opacity: 0, transform: "scale(0.97)" }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  exit={{ opacity: 0, transform: "scale(0.97)" }}
                  transition={transition}
                  style={{ willChange: "opacity, transform" }}
                />
              }
              {...props}
            >
              {children}
              <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground data-[side=bottom]:top-1 data-[side=inline-end]:top-1/2! data-[side=inline-end]:-left-1 data-[side=inline-end]:-translate-y-1/2 data-[side=inline-start]:top-1/2! data-[side=inline-start]:-right-1 data-[side=inline-start]:-translate-y-1/2 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
