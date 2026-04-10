import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  ArrowLeft,
  Brain,
  ClipboardCheck,
  GripVertical,
  Plus,
  Terminal,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Textarea } from "@repo/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@repo/ui/form";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import type { ChecklistItemEntity } from "@/models/daos/checklistItemsDao";
import { updateBestPractice } from "@/services/bestPracticesService";
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/services/checklistService";
import { CATEGORIES, LANGUAGES } from "@/pages/BestPracticesPage/constants";

const editFormSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  condition: z.string().min(1, "适用时机不能为空"),
  content: z.string(),
  category: z.string(),
  language: z.string(),
  codeSnippet: z.string(),
  tags: z.string(),
});

type EditFormValues = z.infer<typeof editFormSchema>;

interface ChecklistItemDraft {
  id: string;
  title: string;
  description: string;
  checkType: "script" | "llm";
  script: string;
  sortOrder: number;
  isNew: boolean;
  isDeleted: boolean;
  isDirty: boolean;
}

interface Props {
  bestPractice: BestPracticeEntity;
  checklistItems: ChecklistItemEntity[];
}

export const BestPracticeEditPageContent = ({
  bestPractice,
  checklistItems: initialChecklistItems,
}: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [items, setItems] = useState<ChecklistItemDraft[]>(
    initialChecklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      checkType: item.checkType as "script" | "llm",
      script: item.script ?? "",
      sortOrder: item.sortOrder,
      isNew: false,
      isDeleted: false,
      isDirty: false,
    })),
  );

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: bestPractice.title,
      condition: bestPractice.condition,
      content: bestPractice.content,
      category: bestPractice.category,
      language: bestPractice.language,
      codeSnippet: bestPractice.codeSnippet,
      tags: bestPractice.tags.join(", "),
    },
  });

  const handleCancel = () => {
    void navigate({
      to: "/best-practices/$bestPracticeId",
      params: { bestPracticeId: bestPractice.id },
    });
  };

  const handleAddChecklistItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `ci-${Date.now()}`,
        title: "",
        description: "",
        checkType: "llm",
        script: "",
        sortOrder: prev.length,
        isNew: true,
        isDeleted: false,
        isDirty: true,
      },
    ]);
  };

  const handleUpdateChecklistField = (
    id: string,
    field: keyof Pick<
      ChecklistItemDraft,
      "title" | "description" | "checkType" | "script" | "sortOrder"
    >,
    value: string | number,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value, isDirty: true } : item,
      ),
    );
  };

  const handleDeleteChecklistItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isDeleted: true } : item,
      ),
    );
  };

  const onSubmit = async (values: EditFormValues) => {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Save best practice
    await updateBestPractice({
      data: {
        id: bestPractice.id,
        patch: { ...values, tags },
      },
    });

    // Process checklist items
    for (const item of items) {
      if (item.isDeleted && !item.isNew) {
        await deleteChecklistItem({ data: { id: item.id } });
      } else if (item.isNew && !item.isDeleted && item.title.trim()) {
        await createChecklistItem({
          data: {
            id: item.id,
            bestPracticeId: bestPractice.id,
            title: item.title.trim(),
            description: item.description,
            checkType: item.checkType,
            script: item.checkType === "script" ? item.script : null,
            sortOrder: item.sortOrder,
          },
        });
      } else if (!item.isNew && !item.isDeleted && item.isDirty) {
        await updateChecklistItem({
          data: {
            id: item.id,
            patch: {
              title: item.title.trim(),
              description: item.description,
              checkType: item.checkType,
              script: item.checkType === "script" ? item.script : null,
              sortOrder: item.sortOrder,
            },
          },
        });
      }
    }

    void navigate({
      to: "/best-practices/$bestPracticeId",
      params: { bestPracticeId: bestPractice.id },
    });
  };

  const visibleItems = items.filter((item) => !item.isDeleted);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button
          aria-label={t("common.back")}
          className="h-8 w-8"
          size="icon"
          variant="ghost"
          onClick={handleCancel}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {t("bestPractices.editTitle")}
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground">
            {bestPractice.id}
          </p>
        </div>
      </div>

      {/* Body */}
      <Form {...form}>
        <form
          className="flex-1 overflow-y-auto"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="mx-auto max-w-3xl space-y-6 p-6">
            {/* Basic Info Fields */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("bestPractices.titleLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("bestPractices.titlePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("bestPractices.conditionLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        placeholder={t("bestPractices.conditionPlaceholder")}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("bestPractices.contentLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-y text-xs leading-relaxed"
                        placeholder={t("bestPractices.contentPlaceholder")}
                        rows={10}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => {
                    const handleChange = field.onChange;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("common.category")}
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={handleChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {CATEGORIES.filter(
                                  (c) => c.value !== "all",
                                ).map((c) => (
                                  <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => {
                    const handleChange = field.onChange;
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("common.language")}
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={handleChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {LANGUAGES.map((l) => (
                                  <SelectItem key={l} value={l}>
                                    {l}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="codeSnippet"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("bestPractices.codeSnippetLabel")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-y font-mono text-xs leading-relaxed"
                        placeholder={t("bestPractices.codeSnippetPlaceholder")}
                        rows={6}
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("bestPractices.tagsLabel")}
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="react, hooks, async" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* Checklist Section */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <ClipboardCheck className="h-4 w-4" />
                  {t("bestPractices.checklist")}
                  {visibleItems.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {visibleItems.length}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleAddChecklistItem}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("bestPractices.checklistAddItem")}
                </Button>
              </div>

              {visibleItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {t("bestPractices.checklistEmpty")}
                </p>
              ) : (
                <div className="space-y-3">
                  {visibleItems.map((item, idx) => (
                    <ChecklistItemEditor
                      key={item.id}
                      index={idx}
                      item={item}
                      onDelete={handleDeleteChecklistItem}
                      onUpdate={handleUpdateChecklistField}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pb-6">
              <Button type="button" variant="outline" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting
                  ? t("common.saving")
                  : t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

// ─── ChecklistItemEditor ──────────────────────────────────────────────────────

interface ChecklistItemEditorProps {
  item: ChecklistItemDraft;
  index: number;
  onUpdate: (
    id: string,
    field: keyof Pick<
      ChecklistItemDraft,
      "title" | "description" | "checkType" | "script" | "sortOrder"
    >,
    value: string | number,
  ) => void;
  onDelete: (id: string) => void;
}

const ChecklistItemEditor = ({
  item,
  index,
  onUpdate,
  onDelete,
}: ChecklistItemEditorProps) => {
  const { t } = useTranslation();

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate(item.id, "title", e.target.value);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onUpdate(item.id, "description", e.target.value);

  const handleCheckTypeChange = (value: string | null) => {
    if (value) onUpdate(item.id, "checkType", value);
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
          <Select value={item.checkType} onValueChange={handleCheckTypeChange}>
            <SelectTrigger className="h-8 text-xs">
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
