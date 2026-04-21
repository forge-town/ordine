import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, GripVertical, Terminal, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import type { ChecklistItemDraft } from "./types";

interface ChecklistItemEditorProps {
  item: ChecklistItemDraft;
  index: number;
  onUpdate: (
    id: string,
    field: keyof Pick<
      ChecklistItemDraft,
      "title" | "description" | "checkType" | "script" | "sortOrder"
    >,
    value: string | number
  ) => void;
  onDelete: (id: string) => void;
}

export const ChecklistItemEditor = ({
  item,
  index,
  onUpdate,
  onDelete,
}: ChecklistItemEditorProps) => {
  const { t } = useTranslation();

  const [checkTypeOpen, setCheckTypeOpen] = useState(false);
  const handleCheckTypeOpenChange = (v: boolean) => setCheckTypeOpen(v);
  const handleCheckTypeToggle = () => setCheckTypeOpen((prev) => !prev);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate(item.id, "title", e.target.value);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onUpdate(item.id, "description", e.target.value);

  const handleCheckTypeChange = (value: string | null) => {
    if (value) {
      onUpdate(item.id, "checkType", value);
      setCheckTypeOpen(false);
    }
  };

  const handleScriptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onUpdate(item.id, "script", e.target.value);

  const handleDelete = () => onDelete(item.id);

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {index + 1}
        </span>
        <Input
          className="flex-1"
          placeholder={t("bestPractices.checklistItemTitlePlaceholder")}
          value={item.title}
          onChange={handleTitleChange}
        />
        <Button
          className="h-8 w-8 shrink-0"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>

      <Textarea
        className="resize-none text-xs"
        placeholder={t("bestPractices.checklistItemDescriptionPlaceholder")}
        rows={2}
        value={item.description}
        onChange={handleDescriptionChange}
      />

      <div className="flex items-center gap-3">
        <div className="w-40">
          <Select
            open={checkTypeOpen}
            value={item.checkType}
            onOpenChange={handleCheckTypeOpenChange}
            onValueChange={handleCheckTypeChange}
          >
            <SelectTrigger className="h-8 text-xs" onClick={handleCheckTypeToggle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="llm">
                <span className="flex items-center gap-1.5">
                  <Brain className="h-3 w-3" />
                  {t("bestPractices.checklistItemCheckTypeLlm")}
                </span>
              </SelectItem>
              <SelectItem value="script">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3 w-3" />
                  {t("bestPractices.checklistItemCheckTypeScript")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {item.checkType === "script" && (
        <Textarea
          className="resize-y font-mono text-xs leading-relaxed"
          placeholder={t("bestPractices.checklistItemScriptPlaceholder")}
          rows={5}
          spellCheck={false}
          value={item.script}
          onChange={handleScriptChange}
        />
      )}
    </div>
  );
};
