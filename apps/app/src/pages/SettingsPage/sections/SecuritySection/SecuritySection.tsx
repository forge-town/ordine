import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, SaveButton, SectionHeader } from "../../components";
import { Input } from "@repo/ui/input";

interface SecuritySectionProps {
  values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  onChange: (
    patch: Partial<{
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }>
  ) => void;
  onSave: () => void;
  saved: boolean;
}

export const SecuritySection = ({ values, onChange, onSave, saved }: SecuritySectionProps) => {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const handleCurrentPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ currentPassword: e.target.value });
  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ newPassword: e.target.value });
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ confirmPassword: e.target.value });

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
    onSave();
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
