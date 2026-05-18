import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@repo/ui/badge";
import { pluginRegistry } from "@repo/plugin";
import { PageHeader } from "@/components/PageHeader";

export const PluginsPageContent = () => {
  const { t } = useTranslation();
  const plugins = pluginRegistry.getAllPlugins();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader icon={<Puzzle className="h-4 w-4 text-primary" />} title={t("plugins.title")} />

      <div className="flex-1 overflow-y-auto p-6">
        <p className="mb-6 text-sm text-muted-foreground">{t("plugins.subtitle")}</p>

        {plugins.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("plugins.noPlugins")}</p>
        ) : (
          <div className="grid gap-4">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Puzzle className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{plugin.name}</h3>
                      <Badge variant="secondary">{plugin.version}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{plugin.id}</p>
                  </div>
                </div>

                {plugin.objectTypes && plugin.objectTypes.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("plugins.objectTypes")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {plugin.objectTypes.map((objType) => (
                        <Badge key={objType.id} variant="outline">
                          {objType.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
