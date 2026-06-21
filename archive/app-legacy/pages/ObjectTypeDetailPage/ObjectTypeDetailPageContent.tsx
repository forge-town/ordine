import { Box, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useList } from "@refinedev/core";
import { pluginRegistry } from "@repo/plugin";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageHeader } from "@/components/PageHeader";
import { PageLoadingState } from "@/components/PageLoadingState";
import { Route } from "@/routes/_layout/pipelines.objects.$objectTypeId";

const objectTypeResourceMap: Record<string, string> = {
  "github-project": ResourceName.githubProjects,
};

export const ObjectTypeDetailPageContent = () => {
  const { objectTypeId } = Route.useParams();
  const { t } = useTranslation();
  const objectType = pluginRegistry.getObjectType(objectTypeId);
  const resourceName = objectTypeResourceMap[objectTypeId];

  const { result, query } = useList<Record<string, unknown>>({
    resource: resourceName ?? "__unknown__",
    queryOptions: { enabled: !!resourceName },
  });

  const items = result.data;

  if (!objectType) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Puzzle className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Object type &quot;{objectTypeId}&quot; not found
        </p>
        <Link className="text-sm text-primary underline" to="/pipelines/objects">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        backTo="/pipelines/objects"
        icon={<Box className="h-4 w-4 text-primary" />}
        title={objectType.label}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {query?.isLoading ? (
          <PageLoadingState />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items found</p>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={String(item.id)} className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium">{String(item.name ?? item.id)}</h3>
                {item.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{String(item.description)}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
