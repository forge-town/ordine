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
    }>
  ) => void;
  onSave: () => void;
  saved: boolean;
}

export const SecuritySection = ({ values, onChange, onSave, saved }: SecuritySectionProps) => {
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
      <SectionHeader description="管理密码和登录安全设置" title="安全" />
      <Field label="当前密码">
        <Input
          placeholder="输入当前密码"
          type="password"
          value={values.currentPassword}
          onChange={handleCurrentPasswordChange}
        />
      </Field>
      <Field label="新密码">
        <Input
          placeholder="输入新密码"
          type="password"
          value={values.newPassword}
          onChange={handleNewPasswordChange}
        />
      </Field>
      <Field label="确认新密码">
        <Input
          placeholder="再次输入新密码"
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
