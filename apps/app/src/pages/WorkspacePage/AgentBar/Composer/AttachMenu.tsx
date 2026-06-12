import { useRef, type ChangeEvent } from "react";
import { FileUp, FolderUp, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";

export type AttachMenuProps = {
  disabled?: boolean;
  /** 原始 File 列表；内容读取与截断由 Composer 负责（N14-01）。 */
  onAttach: (files: File[]) => void;
};

type AttachMenuEntry = {
  icon: LucideIcon;
  id: string;
  labelKey: string;
  onSelect: () => void;
};

/**
 * Codex-style "+" attach menu. New attach sources (connectors, screenshots, …)
 * extend the entries list below without touching the Composer.
 */
export const AttachMenu = ({ disabled = false, onAttach }: AttachMenuProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (files.length > 0) {
      onAttach(files);
    }
    event.target.value = "";
  };

  const entries: AttachMenuEntry[] = [
    {
      icon: FileUp,
      id: "files",
      labelKey: "workspace.agentBar.composer.attachMenu.files",
      onSelect: () => fileInputRef.current?.click(),
    },
    {
      icon: FolderUp,
      id: "folder",
      labelKey: "workspace.agentBar.composer.attachMenu.folder",
      onSelect: () => folderInputRef.current?.click(),
    },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            aria-label={t("workspace.agentBar.composer.attach")}
            className="h-7 w-7 rounded-lg"
            data-testid="agent-composer-attach-trigger"
            disabled={disabled}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          {entries.map((entry) => (
            <DropdownMenuItem
              key={entry.id}
              data-testid={`agent-composer-attach-${entry.id}`}
              onClick={entry.onSelect}
            >
              <entry.icon className="mr-2 h-3.5 w-3.5" />
              {t(entry.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        multiple
        className="hidden"
        data-testid="agent-composer-file-input"
        type="file"
        onChange={handleInputChange}
      />
      <input
        ref={folderInputRef}
        multiple
        className="hidden"
        data-testid="agent-composer-folder-input"
        type="file"
        // React has no typing for directory pickers; both attributes are required cross-browser.
        {...({ directory: "", webkitdirectory: "" } as Record<string, string>)}
        onChange={handleInputChange}
      />
    </>
  );
};
