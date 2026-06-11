import { useTranslation } from "react-i18next";
import { SectionHeader } from "../../SectionHeader";

const SHORTCUT_GROUPS = [
  {
    items: ["undo", "redo", "delete", "drillOut"],
    key: "editing",
  },
  {
    items: ["boxSelect", "pan", "zoom"],
    key: "navigation",
  },
] as const;

/** Read-only cheatsheet for the canvas shortcuts (prototype settings.jsx). */
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
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t(`settings.keyboard.groups.${group.key}`)}
            </div>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <div className="flex items-center justify-between gap-3" key={item}>
                  <span className="text-xs text-foreground/85">
                    {t(`settings.keyboard.shortcuts.${item}.label`)}
                  </span>
                  <kbd className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
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
