import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";

interface ExcludedPathsFieldProps {
  excludedPaths?: string[];
  nodeId: string;
  onAdd: (nodeId: string, path: string) => void;
  onRemove: (nodeId: string, path: string) => void;
}

export const ExcludedPathsField = ({
  excludedPaths,
  nodeId,
  onAdd,
  onRemove,
}: ExcludedPathsFieldProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const paths = Array.isArray(excludedPaths) ? excludedPaths : [];

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleAdd = useCallback(() => {
    const trimmed = inputValue.trim();

    if (trimmed && !paths.includes(trimmed)) {
      onAdd(nodeId, trimmed);
      setInputValue("");
    }
  }, [inputValue, paths, nodeId, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd],
  );

  const handleRemove = useCallback(
    (path: string) => {
      onRemove(nodeId, path);
    },
    [nodeId, onRemove],
  );

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {t("canvas.propertiesPanel.fields.excludedPaths")}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          className="h-8 text-sm"
          placeholder="node_modules/"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <Button
          className="h-8 px-2"
          disabled={!inputValue.trim()}
          size="sm"
          type="button"
          variant="outline"
          onClick={handleAdd}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {paths.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {paths.map((path) => (
            <span
              key={path}
              className="inline-flex items-center gap-0.5 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-red-200">
              {path}
              <Button
                aria-label={`${t("canvas.removeExclude")} ${path}`}
                className="h-auto rounded-sm p-0 hover:bg-red-200"
                size="icon-xs"
                type="button"
                variant="ghost"
                onClick={() => handleRemove(path)}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
