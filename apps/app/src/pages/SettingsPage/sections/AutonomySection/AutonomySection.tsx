import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import {
  SELF_HEAL_RETRIES_MAX,
  SELF_HEAL_RETRIES_MIN,
  useAutonomyStore,
} from "@/store/autonomyStore/autonomyStore";
import { SectionHeader } from "../../SectionHeader";

/**
 * N18-05：Autonomy 组（原型 settings.jsx）。selfHealRetries 真接引擎——
 * 每次 Run 随请求下发，0 表示失败节点不再自动重试。
 */
export const AutonomySection = () => {
  const { t } = useTranslation();
  const selfHealRetries = useAutonomyStore((state) => state.selfHealRetries);
  const setSelfHealRetries = useAutonomyStore((state) => state.setSelfHealRetries);

  return (
    <div className="space-y-5" data-testid="settings-autonomy">
      <SectionHeader
        description={t("settings.autonomy.description")}
        title={t("settings.autonomy.title")}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t("settings.autonomy.selfHeal")}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {t("settings.autonomy.selfHealHint")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-surface-2 p-1 ring-1 ring-border">
          <Button
            aria-label={t("settings.autonomy.decrease")}
            className="h-7 w-7 rounded-lg"
            data-testid="settings-autonomy-decrease"
            disabled={selfHealRetries <= SELF_HEAL_RETRIES_MIN}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setSelfHealRetries(selfHealRetries - 1)}
          >
            <Minus className="size-3" />
          </Button>
          <span
            className="w-8 text-center font-mono text-[12.5px] font-medium tabular-nums"
            data-testid="settings-autonomy-value"
          >
            {selfHealRetries}
          </span>
          <Button
            aria-label={t("settings.autonomy.increase")}
            className="h-7 w-7 rounded-lg"
            data-testid="settings-autonomy-increase"
            disabled={selfHealRetries >= SELF_HEAL_RETRIES_MAX}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setSelfHealRetries(selfHealRetries + 1)}
          >
            <Plus className="size-3" />
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("settings.autonomy.deviceScope")}</p>
    </div>
  );
};
