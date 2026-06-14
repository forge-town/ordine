import { useTranslation } from "react-i18next";
import { ClearHistoryPanel } from "../ProjectSection";
import { SectionHeader } from "../../SectionHeader";

const ROWS = ["dataDirectory", "schemaVersion", "localMode"] as const;

const VALUES: Record<(typeof ROWS)[number], string> = {
  dataDirectory: "apps/app/.pglite",
  localMode: "ORDINE_LOCAL_MODE=true",
  schemaVersion: "0030",
};

/** Read-only maintenance facts — no fake destructive buttons. */
export const AdvancedSection = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5" data-testid="settings-advanced">
      <SectionHeader
        description={t("settings.advanced.description")}
        title={t("settings.advanced.title")}
      />
      <div className="divide-y divide-border/70 rounded-2xl bg-surface ring-1 ring-border">
        {ROWS.map((row) => (
          <div className="flex items-center justify-between gap-4 px-4 py-3" key={row}>
            <div className="min-w-0">
              <div className="text-xs font-medium">{t(`settings.advanced.rows.${row}.label`)}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {t(`settings.advanced.rows.${row}.hint`)}
              </div>
            </div>
            <span className="shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
              {VALUES[row]}
            </span>
          </div>
        ))}
      </div>
      <ClearHistoryPanel />
    </div>
  );
};
