import { useEffect, useState } from "react";
import { useList } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import { Boxes, LoaderCircle, Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PipelineAsset } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { ResourceName } from "@/integrations/refine/dataProvider";

export type FindForMeModalProps = {
  onClose: () => void;
};

const SEARCH_DELAY_MS = 900;
const TOP_COUNT = 5;

/** Agent-flavored library scan — ranks reusable assets by how often they ran. */
export const FindForMeModal = ({ onClose }: FindForMeModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searching, setSearching] = useState(true);
  const { result: assetsResult } = useList<PipelineAsset>({
    resource: ResourceName.pipelineAssets,
  });

  useEffect(() => {
    const timer = setTimeout(() => setSearching(false), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  const top = [...assetsResult.data].sort((a, b) => b.totalRuns - a.totalRuns).slice(0, TOP_COUNT);

  return (
    <div
      className="absolute inset-0 z-50 grid place-items-center p-6"
      data-testid="find-for-me-modal"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/10 backdrop-blur-[1px]" />
      <div
        className="relative flex max-h-[88%] w-[440px] flex-col overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2">
            <Sparkles className="size-4 text-foreground/75" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{t("components.findForMe.title")}</div>
            <div className="truncate text-[10.5px] text-muted-foreground">
              {t("components.findForMe.subtitle")}
            </div>
          </div>
          <Button
            aria-label={t("components.findForMe.close")}
            size="icon"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {searching ? (
            <div
              className="grid place-items-center py-12 text-center"
              data-testid="find-for-me-searching"
            >
              <LoaderCircle className="size-5 animate-spin text-foreground/70" />
              <div className="mt-3 text-xs font-medium">{t("components.findForMe.searching")}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {t("components.findForMe.ranking")}
              </div>
            </div>
          ) : top.length === 0 ? (
            <div className="rounded-xl bg-surface-2 p-3 text-xs text-muted-foreground ring-1 ring-border">
              {t("components.findForMe.empty")}
            </div>
          ) : (
            <>
              <div className="px-1 text-[11px] text-muted-foreground">
                {t("components.findForMe.intro")}
              </div>
              {top.map((asset) => (
                <button
                  className="flex w-full items-center gap-3 rounded-xl bg-surface-2 p-2.5 text-left ring-1 ring-border transition-colors hover:bg-accent/50 hover:ring-border-strong"
                  data-testid={`find-for-me-pick-${asset.id}`}
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    void navigate({
                      params: { pipelineId: asset.pipelineId },
                      to: "/workspace/$pipelineId",
                    });
                  }}
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface ring-1 ring-border">
                    <Boxes className="size-3.5 text-foreground/70" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{asset.name}</span>
                    <span className="block truncate text-[10.5px] text-muted-foreground">
                      {asset.description || t("components.findForMe.assetFallback")}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                    {t("components.findForMe.usedTimes", { count: asset.totalRuns })}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
