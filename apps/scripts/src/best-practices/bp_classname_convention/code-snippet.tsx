import { cn } from "@/lib/utils";

<div className={cn("px-4 py-2", isActive && "bg-blue-500", className)} />

<Button
  className={cn(
    "rounded-lg font-medium",
    variant === "primary" && "bg-primary text-white",
    variant === "ghost" && "bg-transparent",
    disabled && "opacity-50 cursor-not-allowed",
  )}
>
  {children}
</Button>
