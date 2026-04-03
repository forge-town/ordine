import { Field, SaveButton, SectionHeader } from "../components";
import { cn } from "@repo/ui/lib/utils";

interface AppearanceSectionProps {
  values: { theme: "light" | "dark" | "system" };
  onChange: (patch: Partial<{ theme: "light" | "dark" | "system" }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const AppearanceSection = ({
  values,
  onChange,
  onSave,
  saved,
}: AppearanceSectionProps) => {
  return (
    <>
      <SectionHeader title="外观" description="自定义应用的视觉风格" />
      <Field label="主题">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onChange({ theme: t })}
              className={cn(
                "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                values.theme === t
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:border-input",
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
