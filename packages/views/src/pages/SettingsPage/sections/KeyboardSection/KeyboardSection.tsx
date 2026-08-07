import { useTranslation } from "react-i18next";
import { SectionHeader } from "../../SectionHeader";

const SHORTCUT_GROUPS = [
  { items: ["undo", "redo", "delete", "drillOut"], key: "editing" },
  { items: ["boxSelect", "pan", "zoom"], key: "navigation" },
] as const;

export const KeyboardSection = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-5" data-testid="settings-keyboard">
      <SectionHeader
        description={t("settings.keyboard.description")}
        title={t("settings.keyboard.title")}
      />
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.key}>
            <div className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
              {t(`settings.keyboard.groups.${group.key}`)}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => (
                <div key={item} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-foreground/85">
                    {t(`settings.keyboard.shortcuts.${item}.label`)}
                  </span>
                  <kbd className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border">
                    {t(`settings.keyboard.shortcuts.${item}.keys`)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
