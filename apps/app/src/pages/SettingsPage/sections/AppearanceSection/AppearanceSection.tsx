import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { Field, SaveButton, SectionHeader } from "../../components";
import { cn } from "@repo/ui/lib/utils";

export const AppearanceSection = () => {
  const { t } = useTranslation();
  const store = useSettingsStore();
  const values = useStore(store, (s) => s.appearance);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const saved = useStore(store, (s) => s.saved);
  const resetSaved = useStore(store, (s) => s.resetSaved);

  const handleLightClick = () =>
    updateSection("appearance", { theme: "light" });
  const handleDarkClick = () => updateSection("appearance", { theme: "dark" });
  const handleSystemClick = () =>
    updateSection("appearance", { theme: "system" });
  const handleSave = () => {
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader
        description={t("settings.appearanceSection.description")}
        title={t("settings.appearanceSection.title")}
      />
      <Field label={t("settings.appearanceSection.theme")}>
        <div className="flex gap-2">
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "light"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input",
            )}
            onClick={handleLightClick}
          >
            {t("settings.appearanceSection.light")}
          </button>
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "dark"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input",
            )}
            onClick={handleDarkClick}
          >
            {t("settings.appearanceSection.dark")}
          </button>
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "system"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input",
            )}
            onClick={handleSystemClick}
          >
            {t("settings.appearanceSection.system")}
          </button>
        </div>
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
