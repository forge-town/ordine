import { useState } from "react";
import { FolderOpen, FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/dialog";
import { FolderBrowser } from "../OutputLocalPathNode/FolderBrowser";

export interface LocalFolderInfo {
  localPath: string;
  label: string;
}

interface PickLocalFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (info: LocalFolderInfo) => void;
  initialPath?: string;
}

export const PickLocalFolderDialog = ({
  open,
  onClose,
  onPick,
  initialPath = "",
}: PickLocalFolderDialogProps) => {
  const { t } = useTranslation();
  const [path, setPath] = useState(initialPath);
  const [browserOpen, setBrowserOpen] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (!v) onClose();
  };

  const handleConfirm = () => {
    if (!path.trim()) return;
    const parts = path.trim().split("/").filter(Boolean);
    const folderName =
      parts.length > 0 ? (parts[parts.length - 1] as string) : path.trim();
    onPick({ localPath: path.trim(), label: folderName });
    onClose();
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setPath(e.target.value);

  const handleBrowseClick = () => setBrowserOpen(true);

  const handleFolderSelect = (selectedPath: string) => {
    setPath(selectedPath);
    setBrowserOpen(false);
  };

  const handleBrowserOpenChange = (v: boolean) => {
    if (!v) setBrowserOpen(false);
  };

  const handleCancel = () => onClose();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleConfirm();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-orange-500" />
              {t("canvas.pickLocalFolder")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("canvas.pickLocalFolderDesc")}
            </p>

            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="flex-1 font-mono text-sm"
                placeholder="/path/to/your/project"
                value={path}
                onChange={handlePathChange}
                onKeyDown={handleKeyDown}
              />
              <Button
                className="shrink-0"
                size="icon"
                title={t("canvas.browseFolder")}
                type="button"
                variant="outline"
                onClick={handleBrowseClick}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!path.trim()}
              type="button"
              onClick={handleConfirm}
            >
              {t("canvas.useThisFolder")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FolderBrowser
        open={browserOpen}
        onOpenChange={handleBrowserOpenChange}
        onSelect={handleFolderSelect}
      />
    </>
  );
};
