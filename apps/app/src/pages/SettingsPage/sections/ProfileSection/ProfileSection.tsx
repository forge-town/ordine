import { useTranslation } from "react-i18next";
import { Field, SaveButton, SectionHeader } from "../../components";
import { Input } from "@repo/ui/input";

interface ProfileSectionProps {
  values: { displayName: string; email: string; bio: string };
  onChange: (patch: Partial<{ displayName: string; email: string; bio: string }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const ProfileSection = ({ values, onChange, onSave, saved }: ProfileSectionProps) => {
  const { t } = useTranslation();
  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ displayName: e.target.value });
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ email: e.target.value });
  const handleBioChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange({ bio: e.target.value });
  const handleSave = onSave;

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
