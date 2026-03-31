import { Field, SaveButton, SectionHeader } from "../components";
import { Input } from "@repo/ui/input";

interface SecuritySectionProps {
  onSave: () => void;
  saved: boolean;
}

export const SecuritySection = ({ onSave, saved }: SecuritySectionProps) => (
  <>
    <SectionHeader title="安全" description="管理密码和登录安全设置" />
    <Field label="当前密码">
      <Input type="password" placeholder="输入当前密码" />
    </Field>
    <Field label="新密码">
      <Input type="password" placeholder="输入新密码" />
    </Field>
    <Field label="确认新密码">
      <Input type="password" placeholder="再次输入新密码" />
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);
