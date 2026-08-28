"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "./lib/utils";
import { AnimatePresence, m, useControlledState, type Transition } from "./lib/motion";
import { Button } from "./button";
import { XIcon } from "lucide-react";

type SheetSide = "top" | "right" | "bottom" | "left";

const SheetContext = React.createContext<boolean | null>(null);

function useSheetOpen() {
  const open = React.useContext(SheetContext);
  if (open === null) {
    throw new Error("SheetContent must be used within Sheet");
  }

  return open;
}

function Sheet({ open, defaultOpen = false, onOpenChange, ...props }: SheetPrimitive.Root.Props) {
  const [isOpen, setIsOpen] = useControlledState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <SheetContext.Provider value={isOpen}>
      <SheetPrimitive.Root
        data-slot="sheet"
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={setIsOpen}
        {...props}
      />
    </SheetContext.Provider>
  );
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ children, ...props }: Omit<SheetPrimitive.Portal.Props, "keepMounted">) {
  const isOpen = useSheetOpen();

  return (
    <AnimatePresence>
      {isOpen && (
        <SheetPrimitive.Portal data-slot="sheet-portal" keepMounted {...props}>
          {children}
        </SheetPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

function SheetOverlay({
  className,
  transition = { duration: 0.2, ease: "easeInOut" },
  ...props
}: Omit<SheetPrimitive.Backdrop.Props, "render"> & { transition?: Transition }) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-black/10", className)}
      render={
        <m.div
          data-slot="sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        />
      }
      {...props}
    />
  );
}

const offscreenTransform: Record<SheetSide, string> = {
  right: "translateX(100%)",
  left: "translateX(-100%)",
  top: "translateY(-100%)",
  bottom: "translateY(100%)",
};

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  transition = { type: "spring", stiffness: 150, damping: 22 },
  ...props
}: Omit<SheetPrimitive.Popup.Props, "render"> & {
  side?: SheetSide;
  showCloseButton?: boolean;
  transition?: Transition;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg",
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t",
          "data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r",
          "data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l",
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b",
          "data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className,
        )}
        data-side={side}
        render={
          <m.div
            data-slot="sheet-content"
            initial={{ opacity: 0, transform: offscreenTransform[side] }}
            animate={{ opacity: 1, transform: "translate(0, 0)" }}
            exit={{ opacity: 0, transform: offscreenTransform[side] }}
            transition={transition}
            style={{ willChange: "opacity, transform" }}
          />
        }
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
};
