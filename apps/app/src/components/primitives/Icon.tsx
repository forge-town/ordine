import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

export type IconProps = {
  className?: string;
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  title?: string;
};

export const Icon = ({
  className,
  icon: IconComponent,
  size = 16,
  strokeWidth = 2,
  style,
  title,
}: IconProps) => {
  return (
    <IconComponent
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      size={size}
      strokeWidth={strokeWidth}
      style={style}
    />
  );
};
