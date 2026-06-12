import { useRef, type ChangeEvent } from "react";
import { FileUp, FolderUp, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConversationAttachment } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";

export type AttachMenuProps = {
  disabled?: boolean;
  onAttach: (attachments: ConversationAttachment[]) => void;
};

type AttachMenuEntry = {
  icon: LucideIcon;
  id: string;
  labelKey: string;
  onSelect: () => void;
};

const toAttachment = (file: File): ConversationAttachment => {
  // webkitRelativePath is only populated for directory uploads (and missing in older jsdom).
  const relativePath: string = file.webkitRelativePath ?? "";

  return {
    name: relativePath.length > 0 ? relativePath : file.name,
    type: file.type.length > 0 ? file.type : undefined,
  };
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
      onAttach(files.map(toAttachment));
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
