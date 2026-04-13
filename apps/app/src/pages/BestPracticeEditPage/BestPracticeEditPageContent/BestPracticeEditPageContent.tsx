import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  ArrowLeft,
  Brain,
  ClipboardCheck,
  Download,
  GripVertical,
  Plus,
  Terminal,
  Trash2,
  Upload,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import type { ChecklistItemEntity } from "@/models/daos/checklistItemsDao";
import { updateBestPractice } from "@/services/bestPracticesService";
import {
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/services/checklistService";
import { CATEGORIES, LANGUAGES } from "@/pages/BestPracticesPage/constants";
import { toJson, fromJson, toCsv, fromCsv, downloadFile, readFileContent } from "../checklistIO";
import { ok } from "neverthrow";

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

  const editFormSchema = z.object({
    title: z.string().min(1, t("validation.titleRequired")),
    condition: z.string().min(1, t("validation.conditionRequired")),
    content: z.string(),
    category: z.string(),
    language: z.string(),
    codeSnippet: z.string(),
    tags: z.string(),
  });

  type EditFormValues = z.infer<typeof editFormSchema>;

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
    }))
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

  const [categoryOpen, setCategoryOpen] = useState(false);
  const handleCategoryOpenChange = (v: boolean) => setCategoryOpen(v);
  const handleCategoryToggle = () => setCategoryOpen((prev) => !prev);

  const [languageOpen, setLanguageOpen] = useState(false);
  const handleLanguageOpenChange = (v: boolean) => setLanguageOpen(v);
  const handleLanguageToggle = () => setLanguageOpen((prev) => !prev);

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
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value, isDirty: true } : item))
    );
  };

  const handleDeleteChecklistItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isDeleted: true } : item)));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    const exportItems = visibleItems.map((item) => ({
      title: item.title,
      description: item.description,
      checkType: item.checkType,
      script: item.checkType === "script" ? item.script || null : null,
      sortOrder: item.sortOrder,
    }));
    downloadFile(toJson(exportItems), `checklist-${bestPractice.id}.json`, "application/json");
  };

  const handleExportCsv = () => {
    const exportItems = visibleItems.map((item) => ({
      title: item.title,
      description: item.description,
      checkType: item.checkType,
      script: item.checkType === "script" ? item.script || null : null,
      sortOrder: item.sortOrder,
    }));
    downloadFile(toCsv(exportItems), `checklist-${bestPractice.id}.csv`, "text/csv");
  };

  const handleImport = async (file: File) => {
    const content = await readFileContent(file);
    const isJson = file.name.endsWith(".json");
    const parsed = isJson ? fromJson(content) : ok(fromCsv(content));
    if (parsed.isErr()) return;

    const baseOrder = items.length;
    const newDrafts: ChecklistItemDraft[] = parsed.value.map((item, idx) => ({
      id: `ci-import-${Date.now()}-${idx}`,
      title: item.title,
      description: item.description,
      checkType: item.checkType,
      script: item.script ?? "",
      sortOrder: baseOrder + idx,
      isNew: true,
      isDeleted: false,
      isDirty: true,
    }));

    setItems((prev) => [...prev, ...newDrafts]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImport(file);
    e.target.value = "";
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const visibleItems = items.filter((item) => !item.isDeleted);

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
          <p className="font-mono text-[11px] text-muted-foreground">{bestPractice.id}</p>
        </div>
      </div>

      {/* Body */}
      <Form {...form}>
        <form className="flex-1 overflow-y-auto" onSubmit={form.handleSubmit(onSubmit)}>
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
                      <Input placeholder={t("bestPractices.titlePlaceholder")} {...field} />
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
                    <div className="grid grid-cols-2 gap-3">
                      <FormControl>
                        <Textarea
                          className="resize-none text-xs leading-relaxed h-60"
                          placeholder={t("bestPractices.contentPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <div className="h-60 overflow-y-auto rounded-md border border-input bg-muted/30 px-3 py-2 text-xs leading-relaxed [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:mb-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:mb-2 [&_strong]:font-semibold [&_hr]:border-border [&_hr]:my-2">
                        {field.value ? (
                          <ReactMarkdown>{field.value}</ReactMarkdown>
                        ) : (
                          <span className="text-muted-foreground/50">
                            {t("bestPractices.contentPlaceholder")}
                          </span>
                        )}
                      </div>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => {
                    const handleChange = (v: string | null) => {
                      if (v) field.onChange(v);
                      setCategoryOpen(false);
                    };
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("common.category")}
                        </FormLabel>
                        <FormControl>
                          <Select
                            open={categoryOpen}
                            value={field.value}
                            onOpenChange={handleCategoryOpenChange}
                            onValueChange={handleChange}
                          >
                            <SelectTrigger className="w-full" onClick={handleCategoryToggle}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
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
                    const handleChange = (v: string | null) => {
                      if (v) field.onChange(v);
                      setLanguageOpen(false);
                    };
                    return (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("common.language")}
                        </FormLabel>
                        <FormControl>
                          <Select
                            open={languageOpen}
                            value={field.value}
                            onOpenChange={handleLanguageOpenChange}
                            onValueChange={handleChange}
                          >
                            <SelectTrigger className="w-full" onClick={handleLanguageToggle}>
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
                render={({ field }) => {
                  const lang = form.watch("language");
                  const extensions =
                    lang === "typescript" || lang === "tsx" || lang === "javascript"
                      ? [javascript({ typescript: true, jsx: true })]
                      : [];
                  const handleCodeChange = (value: string) => {
                    field.onChange(value);
                  };
                  return (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-medium text-muted-foreground">
                          {t("bestPractices.codeSnippetLabel")}
                        </FormLabel>
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                          {lang}
                        </span>
                      </div>
                      <FormControl>
                        <div className="overflow-hidden rounded-md border border-border text-xs">
                          <CodeMirror
                            extensions={extensions}
                            height="240px"
                            placeholder={t("bestPractices.codeSnippetPlaceholder")}
                            theme={oneDark}
                            value={field.value}
                            onChange={handleCodeChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  );
                }}
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
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    accept=".json,.csv"
                    className="hidden"
                    type="file"
                    onChange={handleFileChange}
                  />
                  <Button size="sm" type="button" variant="outline" onClick={handleImportClick}>
                    <Upload className="h-3.5 w-3.5" />
                    {t("bestPractices.checklistImport")}
                  </Button>
                  {visibleItems.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-xs hover:bg-accent hover:text-accent-foreground">
                        <Download className="h-3.5 w-3.5" />
                        {t("bestPractices.checklistExport")}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportJson}>
                          {t("bestPractices.checklistExportJson")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportCsv}>
                          {t("bestPractices.checklistExportCsv")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
                {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
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
    value: string | number
  ) => void;
  onDelete: (id: string) => void;
}

const ChecklistItemEditor = ({ item, index, onUpdate, onDelete }: ChecklistItemEditorProps) => {
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
