import { useState } from "react";
import { useTranslation } from "react-i18next";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { LANGUAGES } from "@/pages/BestPracticesPage/constants";
import type { CodeSnippetDraft } from "./types";

interface CodeSnippetEditorProps {
  snippet: CodeSnippetDraft;
  index: number;
  onUpdate: (
    id: string,
    field: keyof Pick<CodeSnippetDraft, "title" | "language" | "code" | "sortOrder">,
    value: string | number
  ) => void;
  onDelete: (id: string) => void;
}

export const CodeSnippetEditor = ({
  snippet,
  index,
  onUpdate,
  onDelete,
}: CodeSnippetEditorProps) => {
  const { t } = useTranslation();

  const [languageOpen, setLanguageOpen] = useState(false);
  const handleLanguageOpenChange = (v: boolean) => setLanguageOpen(v);
  const handleLanguageToggle = () => setLanguageOpen((prev) => !prev);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate(snippet.id, "title", e.target.value);

  const handleLanguageChange = (value: string | null) => {
    if (value) {
      onUpdate(snippet.id, "language", value);
      setLanguageOpen(false);
    }
  };

  const handleCodeChange = (value: string) => onUpdate(snippet.id, "code", value);

  const handleDelete = () => onDelete(snippet.id);

  const extensions =
    snippet.language === "typescript" ||
    snippet.language === "tsx" ||
    snippet.language === "javascript"
      ? [javascript({ typescript: true, jsx: true })]
      : [];

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
          {index + 1}
        </span>
        <Input
          className="flex-1"
          placeholder={t("bestPractices.codeSnippetTitlePlaceholder")}
          value={snippet.title}
          onChange={handleTitleChange}
        />
        <div className="w-32">
          <Select
            open={languageOpen}
            value={snippet.language}
            onOpenChange={handleLanguageOpenChange}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="h-8 text-xs" onClick={handleLanguageToggle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      <div className="overflow-hidden rounded-md border border-border text-xs">
        <CodeMirror
          extensions={extensions}
          height="200px"
          placeholder={t("bestPractices.codeSnippetPlaceholder")}
          theme={oneDark}
          value={snippet.code}
          onChange={handleCodeChange}
        />
      </div>
    </div>
  );
};
