import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { Field, SaveButton, SectionHeader } from "../../components";
import { Input } from "@repo/ui/input";

export const ProfileSection = () => {
  const { t } = useTranslation();
  const store = useSettingsStore();
  const values = useStore(store, (s) => s.profile);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const saved = useStore(store, (s) => s.saved);
  const resetSaved = useStore(store, (s) => s.resetSaved);

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateSection("profile", { displayName: e.target.value });
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateSection("profile", { email: e.target.value });
  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    updateSection("profile", { bio: e.target.value });
  const handleSave = () => {
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader
        description={t("settings.profile.description")}
        title={t("settings.profile.title")}
      />
      <Field label={t("settings.profile.displayName")}>
        <Input value={values.displayName} onChange={handleDisplayNameChange} />
      </Field>
      <Field label={t("settings.profile.email")}>
        <Input type="email" value={values.email} onChange={handleEmailChange} />
      </Field>
      <Field label={t("settings.profile.bio")}>
        <textarea
          className="rounded-md border bg-muted/30 px-3 py-2 text-sm resize-none focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
          rows={3}
          value={values.bio}
          onChange={handleBioChange}
        />
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
