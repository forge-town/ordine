import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import {
  SELF_HEAL_RETRIES_MAX,
  SELF_HEAL_RETRIES_MIN,
  useAutonomyStore,
} from "../../../../store/autonomyStore";
import { SectionHeader } from "../../SectionHeader";

export const AutonomySection = () => {
  const { t } = useTranslation();
  const store = useAutonomyStore();
  const selfHealRetries = useStore(store, (state) => state.selfHealRetries);
  const setSelfHealRetries = useStore(store, (state) => state.setSelfHealRetries);
  const handleDecrease = () => setSelfHealRetries(selfHealRetries - 1);
  const handleIncrease = () => setSelfHealRetries(selfHealRetries + 1);

  return (
    <div className="space-y-5" data-testid="settings-autonomy">
      <SectionHeader
        description={t("settings.autonomy.description")}
        title={t("settings.autonomy.title")}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t("settings.autonomy.selfHeal")}</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("settings.autonomy.selfHealHint")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border bg-muted p-1">
          <Button
            aria-label={t("settings.autonomy.decrease")}
            className="h-7 w-7 rounded-md"
            data-testid="settings-autonomy-decrease"
            disabled={selfHealRetries <= SELF_HEAL_RETRIES_MIN}
            size="icon"
            type="button"
            variant="ghost"
            onClick={handleDecrease}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span
            className="w-8 text-center font-mono text-xs font-medium tabular-nums"
            data-testid="settings-autonomy-value"
          >
            {selfHealRetries}
          </span>
          <Button
            aria-label={t("settings.autonomy.increase")}
            className="h-7 w-7 rounded-md"
            data-testid="settings-autonomy-increase"
            disabled={selfHealRetries >= SELF_HEAL_RETRIES_MAX}
            size="icon"
            type="button"
            variant="ghost"
            onClick={handleIncrease}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.autonomy.deviceScope")}</p>
    </div>
  );
};
