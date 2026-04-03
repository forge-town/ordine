import { useState } from "react";
import { Field, SaveButton, SectionHeader } from "../components";
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
    }>,
  ) => void;
  onSave: () => void;
  saved: boolean;
}

export const SecuritySection = ({
  values,
  onChange,
  onSave,
  saved,
}: SecuritySectionProps) => {
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (values.newPassword || values.confirmPassword) {
      if (values.newPassword.length < 6) {
        setError("新密码长度不能少于 6 位");
        return;
      }
      if (values.newPassword !== values.confirmPassword) {
        setError("两次输入的新密码不一致");
        return;
      }
      if (!values.currentPassword) {
        setError("请输入当前密码");
        return;
      }
    }
    onSave();
  };

  return (
    <>
      <SectionHeader title="安全" description="管理密码和登录安全设置" />
      <Field label="当前密码">
        <Input
          type="password"
          placeholder="输入当前密码"
          value={values.currentPassword}
          onChange={(e) => onChange({ currentPassword: e.target.value })}
        />
      </Field>
      <Field label="新密码">
        <Input
          type="password"
          placeholder="输入新密码"
          value={values.newPassword}
          onChange={(e) => onChange({ newPassword: e.target.value })}
        />
      </Field>
      <Field label="确认新密码">
        <Input
          type="password"
          placeholder="再次输入新密码"
          value={values.confirmPassword}
          onChange={(e) => onChange({ confirmPassword: e.target.value })}
        />
      </Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <SaveButton onSave={handleSave} saved={saved} />
    </>
  );
};
