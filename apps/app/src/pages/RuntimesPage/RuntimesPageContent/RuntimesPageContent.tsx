import { Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { RuntimeList } from "../RuntimeList";
import { RuntimeDetail } from "../RuntimeDetail";

export const RuntimesPageContent = ({ isLoading }: { isLoading: boolean }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          icon={<Server className="h-4 w-4 text-primary" />}
          title={t("runtimes.title")}
        />
        <div className="flex flex-1 min-h-0">
          <div className="w-72 border-r">
            <div className="flex h-12 items-center justify-between border-b px-4">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 p-6 space-y-6">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader icon={<Server className="h-4 w-4 text-primary" />} title={t("runtimes.title")} />

      <div className="flex flex-1 min-h-0">
        <div className="w-72 shrink-0">
          <RuntimeList />
        </div>

        <div className="flex-1 min-w-0">
          <RuntimeDetail />
        </div>
      </div>
    </div>
  );
};
