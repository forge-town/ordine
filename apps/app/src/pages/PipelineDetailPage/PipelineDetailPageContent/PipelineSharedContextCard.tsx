import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";

export type PipelineSharedContextCardProps = {
  value: string;
  isSaving?: boolean;
  onSave: (sharedContext: string) => void;
};

// COD-40：Pipeline 级"共享上下文"编辑器。这里写的内容会在运行时注入到该 Pipeline
// 内每个 Operation 的 agent prompt（全局/局部分离），无需在每个 Operation 重复粘贴。
// 纯展示组件——保存的副作用由父页面（边界层）通过 onSave 注入。
export const PipelineSharedContextCard = ({
  value,
  isSaving = false,
  onSave,
}: PipelineSharedContextCardProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  return (
    <div
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
      data-testid="pipeline-shared-context-card"
    >
      <div className="flex items-center gap-2">
        <MessagesSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-gray-800">
          {t("pipelines.sharedContext.label")}
        </h3>
      </div>
      <p className="mt-1 text-xs text-gray-500">{t("pipelines.sharedContext.description")}</p>
      <Textarea
        className="mt-3"
        data-testid="pipeline-shared-context-input"
        placeholder={t("pipelines.sharedContext.placeholder")}
        rows={4}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button
          data-testid="pipeline-shared-context-save"
          disabled={!dirty || isSaving}
          size="sm"
          onClick={() => onSave(draft)}
        >
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
};
