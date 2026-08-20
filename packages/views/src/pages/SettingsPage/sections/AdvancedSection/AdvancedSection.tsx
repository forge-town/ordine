import { useTranslation } from "react-i18next";
import { SectionHeader } from "../../SectionHeader";
import { ClearHistoryPanel } from "../ProjectSection";

const ROWS = ["databaseUrl", "schemaVersion", "localMode"] as const;

const VALUES: Record<(typeof ROWS)[number], string> = {
  databaseUrl: "DATABASE_URL",
  localMode: "ORDINE_LOCAL_MODE",
  schemaVersion: "auto",
};

export const AdvancedSection = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5" data-testid="settings-advanced">
      <SectionHeader
        description={t("settings.advanced.description")}
        title={t("settings.advanced.title")}
      />
      <div className="divide-y divide-border overflow-hidden rounded-md border bg-background">
        {ROWS.map((row) => (
          <div
            key={row}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium">{t(`settings.advanced.rows.${row}.label`)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t(`settings.advanced.rows.${row}.hint`)}
              </div>
            </div>
            <span className="w-fit max-w-full break-all rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground ring-1 ring-border">
              {VALUES[row]}
            </span>
          </div>
        ))}
      </div>
      <ClearHistoryPanel />
    </div>
  );
};
