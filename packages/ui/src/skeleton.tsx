import { cn } from "./lib/utils";
import type { ComponentPropsWithoutRef } from "react";

function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
