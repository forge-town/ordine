import { Grid3X3, Map, MousePointer2, Settings2, X, Magnet } from "lucide-react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Link } from "@tanstack/react-router";
import { Button } from "@repo/ui/button";
import { Label } from "@repo/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore, type CanvasSettingsState } from "../_store";

const settingEntries = [
  { id: "showMiniMap" as const, icon: Map },
  { id: "showControls" as const, icon: MousePointer2 },
  { id: "showBackground" as const, icon: Grid3X3 },
  { id: "snapToGrid" as const, icon: Magnet },
];

export const CanvasSettingsDrawer = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const isOpen = useStore(store, (s) => s.isCanvasSettingsOpen);
  const settings = useStore(store, (s) => s.canvasSettings);
  const openCanvasSettings = useStore(store, (s) => s.openCanvasSettings);
  const closeCanvasSettings = useStore(store, (s) => s.closeCanvasSettings);
  const updateCanvasSettings = useStore(store, (s) => s.updateCanvasSettings);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openCanvasSettings();

      return;
    }

    closeCanvasSettings();
  };

  const handleSettingChange = (
    id: keyof CanvasSettingsState,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    updateCanvasSettings({ [id]: event.target.checked } as Partial<CanvasSettingsState>);
  };

  const handleGlobalSettingsClick = () => {
    closeCanvasSettings();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent
        className="w-[min(24rem,calc(100vw-1rem))] max-w-sm gap-0 border-l bg-white/95 p-0 backdrop-blur"
        showCloseButton={false}
        side="right"
      >
        <SheetHeader className="border-b pr-12">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-slate-100 text-slate-700">
              <Settings2 className="size-4" />
            </span>
            <SheetTitle>{t("canvas.settingsDrawer.title")}</SheetTitle>
          </div>
          <SheetDescription>{t("canvas.settingsDrawer.description")}</SheetDescription>
          <SheetClose
            render={
              <Button
                aria-label={t("canvas.settingsDrawer.close")}
                className="absolute right-3 top-3"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <X className="size-4" />
          </SheetClose>
        </SheetHeader>

        <div
          aria-label={t("canvas.settingsDrawer.title")}
          className="flex-1 space-y-3 overflow-y-auto p-4"
          role="group"
        >
          {settingEntries.map(({ id, icon: Icon }) => {
            const inputId = `canvas-setting-${id}`;
            const descriptionId = `${inputId}-description`;

            return (
              <div
                key={id}
                className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3 shadow-sm"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Label className="text-slate-800" htmlFor={inputId}>
                    {t(`canvas.settingsDrawer.${id}.label`)}
                  </Label>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500" id={descriptionId}>
                    {t(`canvas.settingsDrawer.${id}.description`)}
                  </p>
                </div>
                <input
                  aria-describedby={descriptionId}
                  checked={settings[id]}
                  className={cn(
                    "mt-1 size-4 rounded border-slate-300 text-slate-900",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                  )}
                  id={inputId}
                  type="checkbox"
                  onChange={(event) => handleSettingChange(id, event)}
                />
              </div>
            );
          })}
        </div>

        <div className="border-t bg-slate-50 p-4">
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            to="/settings"
            onClick={handleGlobalSettingsClick}
          >
            {t("canvas.settingsDrawer.globalSettings")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
};
