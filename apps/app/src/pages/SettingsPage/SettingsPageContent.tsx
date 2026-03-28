import { useState } from "react";
import { User, Bell, Palette, Globe, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Section =
  | "profile"
  | "notifications"
  | "appearance"
  | "language"
  | "security";

const sections: {
  id: Section;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: "profile", label: "个人信息", icon: User },
  { id: "notifications", label: "通知", icon: Bell },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "language", label: "语言与地区", icon: Globe },
  { id: "security", label: "安全", icon: Shield },
];

export const SettingsPageContent = () => {
  const [active, setActive] = useState<Section>("profile");
  const [saved, setSaved] = useState(false);

  const saveChanges = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-6">
        <h1 className="text-base font-semibold text-gray-900">设置</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-52 shrink-0 border-r border-gray-100 bg-white py-4">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                active === s.id
                  ? "bg-violet-50 text-violet-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              {s.label}
              {active === s.id && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-violet-400" />
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-lg space-y-6">
            {active === "profile" && (
              <ProfileSection onSave={saveChanges} saved={saved} />
            )}
            {active === "notifications" && (
              <NotificationsSection onSave={saveChanges} saved={saved} />
            )}
            {active === "appearance" && (
              <AppearanceSection onSave={saveChanges} saved={saved} />
            )}
            {active === "language" && (
              <LanguageSection onSave={saveChanges} saved={saved} />
            )}
            {active === "security" && (
              <SecuritySection onSave={saveChanges} saved={saved} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="border-b border-gray-100 pb-4">
    <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    <p className="mt-0.5 text-xs text-gray-400">{description}</p>
  </div>
);

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-gray-600">{label}</label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors"
  />
);

const SaveButton = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => (
  <button
    onClick={onSave}
    className={cn(
      "mt-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
      saved
        ? "bg-emerald-100 text-emerald-700"
        : "bg-violet-600 text-white hover:bg-violet-700",
    )}
  >
    {saved ? "已保存 ✓" : "保存更改"}
  </button>
);

const Toggle = ({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
}) => (
  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
    <span className="text-sm text-gray-700">{label}</span>
    <button
      onClick={onToggle}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        enabled ? "bg-violet-600" : "bg-gray-200",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  </div>
);

const ProfileSection = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => (
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
        className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 resize-none focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors"
      />
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);

const NotificationsSection = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => {
  const [toggles, setToggles] = useState({
    pipeline: true,
    mention: true,
    weekly: false,
  });
  const toggle = (k: keyof typeof toggles) =>
    setToggles((p) => ({ ...p, [k]: !p[k] }));
  return (
    <>
      <SectionHeader title="通知" description="选择你希望接收哪些通知" />
      <Toggle
        enabled={toggles.pipeline}
        onToggle={() => toggle("pipeline")}
        label="Pipeline 运行完成提醒"
      />
      <Toggle
        enabled={toggles.mention}
        onToggle={() => toggle("mention")}
        label="被 @提及时通知"
      />
      <Toggle
        enabled={toggles.weekly}
        onToggle={() => toggle("weekly")}
        label="每周摘要邮件"
      />
      <SaveButton onSave={onSave} saved={saved} />
    </>
  );
};

const AppearanceSection = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  return (
    <>
      <SectionHeader title="外观" description="自定义应用的视觉风格" />
      <Field label="主题">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                theme === t
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300",
              )}
            >
              {t === "light" ? "浅色" : t === "dark" ? "深色" : "跟随系统"}
            </button>
          ))}
        </div>
      </Field>
      <SaveButton onSave={onSave} saved={saved} />
    </>
  );
};

const LanguageSection = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => (
  <>
    <SectionHeader title="语言与地区" description="选择界面语言和时区偏好" />
    <Field label="界面语言">
      <select className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none">
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English (US)</option>
        <option value="ja-JP">日本語</option>
      </select>
    </Field>
    <Field label="时区">
      <select className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-violet-400 focus:outline-none">
        <option value="Asia/Shanghai">亚洲 / 上海 (UTC+8)</option>
        <option value="UTC">UTC</option>
        <option value="America/New_York">美洲 / 纽约 (UTC-5)</option>
      </select>
    </Field>
    <SaveButton onSave={onSave} saved={saved} />
  </>
);

const SecuritySection = ({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) => (
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
