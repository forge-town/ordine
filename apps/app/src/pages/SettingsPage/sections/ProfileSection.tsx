import { Field, SaveButton, SectionHeader } from "../components";
import { Input } from "@repo/ui/input";

interface ProfileSectionProps {
  values: { displayName: string; email: string; bio: string };
  onChange: (patch: Partial<{ displayName: string; email: string; bio: string }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const ProfileSection = ({
  values,
  onChange,
  onSave,
  saved,
}: ProfileSectionProps) => (
  <>
    <SectionHeader title="个人信息" description="管理你的账户名称和联系信息" />
    <Field label="显示名称">
      <Input
        value={values.displayName}
        onChange={(e) => onChange({ displayName: e.target.value })}
      />
    </Field>
    <Field label="邮箱">
      <Input
        type="email"
        value={values.email}
        onChange={(e) => onChange({ email: e.target.value })}
      />
    </Field>
    <Field label="简介">
      <textarea
        value={values.bio}
        onChange={(e) => onChange({ bio: e.target.value })}
        rows={3}
        className="rounded-md border bg-muted/30 px-3 py-2 text-sm resize-none focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
      />
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);
