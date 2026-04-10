import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSettingsStore } from "../../_store";
import { Field, SaveButton, SectionHeader } from "../../components";
import { Input } from "@repo/ui/input";

export const SecuritySection = () => {
  const { t } = useTranslation();
  const store = useSettingsStore();
  const values = useStore(store, (s) => s.security);
  const updateSection = useStore(store, (s) => s.updateSection);
  const save = useStore(store, (s) => s.save);
  const saved = useStore(store, (s) => s.saved);
  const resetSaved = useStore(store, (s) => s.resetSaved);
  const [error, setError] = useState<string | null>(null);

  const handleCurrentPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => updateSection("security", { currentPassword: e.target.value });
  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    updateSection("security", { newPassword: e.target.value });
  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => updateSection("security", { confirmPassword: e.target.value });

  const handleSave = () => {
    setError(null);
    if (values.newPassword || values.confirmPassword) {
      if (values.newPassword.length < 6) {
        setError(t("settings.securitySection.errorMinLength"));
        return;
      }
      if (values.newPassword !== values.confirmPassword) {
        setError(t("settings.securitySection.errorMismatch"));
        return;
      }
      if (!values.currentPassword) {
        setError(t("settings.securitySection.errorCurrentRequired"));
        return;
      }
    }
    save();
    setTimeout(resetSaved, 2000);
  };

  return (
    <>
      <SectionHeader
        description={t("settings.securitySection.description")}
        title={t("settings.securitySection.title")}
      />
      <Field label={t("settings.securitySection.currentPassword")}>
        <Input
          placeholder={t("settings.securitySection.currentPasswordPlaceholder")}
          type="password"
          value={values.currentPassword}
          onChange={handleCurrentPasswordChange}
        />
      </Field>
      <Field label={t("settings.securitySection.newPassword")}>
        <Input
          placeholder={t("settings.securitySection.newPasswordPlaceholder")}
          type="password"
          value={values.newPassword}
          onChange={handleNewPasswordChange}
        />
      </Field>
      <Field label={t("settings.securitySection.confirmPassword")}>
        <Input
          placeholder={t("settings.securitySection.confirmPasswordPlaceholder")}
          type="password"
          value={values.confirmPassword}
          onChange={handleConfirmPasswordChange}
        />
      </Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
