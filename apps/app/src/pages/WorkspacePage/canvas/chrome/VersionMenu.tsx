import { ChevronDown, GitBranch, GitCommitHorizontal, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { ScrollArea } from "@repo/ui/scroll-area";

export type VersionMenuRunState = "done" | "draft" | "running";

export type VersionMenuProps = {
  dirty: boolean;
  runState: VersionMenuRunState;
  version: number;
  onOverwrite: () => void;
  onSaveAsNew: () => void;
};

export const VersionMenu = ({
  dirty,
  runState,
  version,
  onOverwrite,
  onSaveAsNew,
}: VersionMenuProps) => {
  const { t } = useTranslation();
  const versions = Array.from({ length: version }, (_, index) => version - index);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-0.5 flex items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/70"
        data-testid="canvas-v2-version-menu-trigger"
      >
        <span className="font-mono">v{version}</span>
          {dirty ? (
            <span className="flex items-center gap-1 text-foreground/80">
              <span className="size-1.5 rounded-full bg-warning" />
              {t("workspace.canvas.chrome.version.unsaved")}
            </span>
          ) : (
            <span>
              · {t(`workspace.canvas.chrome.version.state.${runState}`)} ·{" "}
              {t("workspace.canvas.chrome.version.saved")}
            </span>
          )}
        <ChevronDown className="size-2.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-2xl" sideOffset={6}>
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("workspace.canvas.chrome.version.saveChanges")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          data-testid="canvas-v2-version-overwrite"
          disabled={!dirty}
          onClick={onOverwrite}
        >
          <Save className="size-3.5 text-muted-foreground" />
          <span className="flex-1">
            {t("workspace.canvas.chrome.version.overwrite", { version })}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="canvas-v2-version-save-as-new" onClick={onSaveAsNew}>
          <GitBranch className="size-3.5 text-muted-foreground" />
          <span className="flex-1">{t("workspace.canvas.chrome.version.saveAsNew")}</span>
          <span className="font-mono text-[10px] text-muted-foreground">v{version + 1}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("workspace.canvas.chrome.version.history")}
        </DropdownMenuLabel>
        <ScrollArea className="max-h-32">
          {versions.map((entry) => (
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs" key={entry}>
              <GitCommitHorizontal className="size-3.5 text-muted-foreground" />
              <span className="flex-1 font-mono">v{entry}</span>
              {entry === version ? (
                <span className="text-[10px] text-muted-foreground">
                  {t("workspace.canvas.chrome.version.current")}
                </span>
              ) : null}
            </div>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
