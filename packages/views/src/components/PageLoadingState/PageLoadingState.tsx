import { Loader2 } from "lucide-react";
import { Skeleton } from "@repo/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";

const LIST_PLACEHOLDERS = [0, 1, 2, 3];
const GRID_PLACEHOLDERS = [0, 1, 2, 3, 4, 5];

export type PageLoadingStateProps = {
  className?: string;
  variant?: "detail" | "grid" | "list";
};

const renderListSkeleton = () => {
  return LIST_PLACEHOLDERS.map((item) => (
    <div key={item} className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  ));
};

const renderGridSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GRID_PLACEHOLDERS.map((item) => (
        <div key={item} className="rounded-xl border border-border bg-card p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
};

const renderDetailSkeleton = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
};

export const PageLoadingState = ({ className, variant = "list" }: PageLoadingStateProps) => {
  return (
    <div
      className={cn("flex flex-1 flex-col gap-4 p-6", className)}
      data-testid="page-loading-state"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>

      {variant === "grid"
        ? renderGridSkeleton()
        : variant === "detail"
          ? renderDetailSkeleton()
          : renderListSkeleton()}
    </div>
  );
};
