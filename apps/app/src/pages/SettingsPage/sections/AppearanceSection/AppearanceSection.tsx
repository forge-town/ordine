import { Field, SaveButton, SectionHeader } from "../../components";
import { cn } from "@repo/ui/lib/utils";

interface AppearanceSectionProps {
  values: { theme: "light" | "dark" | "system" };
  onChange: (patch: Partial<{ theme: "light" | "dark" | "system" }>) => void;
  onSave: () => void;
  saved: boolean;
}

export const AppearanceSection = ({ values, onChange, onSave, saved }: AppearanceSectionProps) => {
  const handleLightClick = () => onChange({ theme: "light" });
  const handleDarkClick = () => onChange({ theme: "dark" });
  const handleSystemClick = () => onChange({ theme: "system" });
  const handleSave = onSave;

  return (
    <>
      <SectionHeader description="自定义应用的视觉风格" title="外观" />
      <Field label="主题">
        <div className="flex gap-2">
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "light"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input"
            )}
            onClick={handleLightClick}
          >
            浅色
          </button>
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "dark"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input"
            )}
            onClick={handleDarkClick}
          >
            深色
          </button>
          <button
            className={cn(
              "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
              values.theme === "system"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-input"
            )}
            onClick={handleSystemClick}
          >
            跟随系统
          </button>
        </div>
      </Field>
      <SaveButton saved={saved} onSave={handleSave} />
    </>
  );
};
