import { Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@repo/ui/badge";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import { pluginRegistry } from "@repo/plugin";
import { PageHeader } from "../../../components/PageHeader";
import { PageState } from "../../../components/PageState";

export const PluginsPageContent = () => {
  const { t } = useTranslation();
  const plugins = pluginRegistry.getAllPlugins();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        eyebrow={t("nav.groups.capabilities")}
        icon={<Puzzle className="h-4 w-4 text-primary" />}
        sub={t("plugins.subtitle")}
        title={t("plugins.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {plugins.length === 0 ? (
          <PageState icon={<Puzzle />} title={t("plugins.noPlugins")} />
        ) : (
          <div className="grid gap-3">
            {plugins.map((plugin) => (
              <div key={plugin.id} className={cn(surfaceCardVariants(), "p-3.5")}>
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
