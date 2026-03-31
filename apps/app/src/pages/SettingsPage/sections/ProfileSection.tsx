import { Field, SaveButton, SectionHeader } from "../components";
import { Input } from "@repo/ui/input";

interface ProfileSectionProps {
  onSave: () => void;
  saved: boolean;
}

export const ProfileSection = ({ onSave, saved }: ProfileSectionProps) => (
  <>
    <SectionHeader title="个人信息" description="管理你的账户名称和联系信息" />
    <Field label="显示名称">
      <Input defaultValue="Ordine 用户" />
    </Field>
    <Field label="邮箱">
      <Input type="email" defaultValue="user@ordine.app" />
    </Field>
    <Field label="简介">
      <textarea
        defaultValue="Skill Pipeline 设计师"
        rows={3}
        className="rounded-md border bg-muted/30 px-3 py-2 text-sm resize-none focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
      />
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);
