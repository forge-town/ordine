import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { ArrowLeft, ClipboardCheck, Code2, Download, Plus, Upload } from "lucide-react";
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
import type { BestPracticeRow, ChecklistItemRow, CodeSnippetRow } from "@repo/models";
import { useUpdate, useCreate, useDelete } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { CATEGORIES, LANGUAGES } from "@/pages/BestPracticesPage/constants";
import { toJson, fromJson, toCsv, fromCsv, downloadFile, readFileContent } from "../checklistIO";
import { ok } from "neverthrow";
import { ChecklistItemEditor } from "./ChecklistItemEditor";
import { CodeSnippetEditor } from "./CodeSnippetEditor";
import type { ChecklistItemDraft, CodeSnippetDraft } from "./types";

interface Props {
  bestPractice: BestPracticeRow;
  checklistItems: ChecklistItemRow[];
  codeSnippets: CodeSnippetRow[];
}

export const BestPracticeEditPageContent = ({
  bestPractice,
  checklistItems: initialChecklistItems,
  codeSnippets: initialCodeSnippets,
}: Props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: updateBpMutate } = useUpdate();
  const { mutateAsync: createMutate } = useCreate();
  const { mutateAsync: deleteMutate } = useDelete();

  const editFormSchema = z.object({
    title: z.string().min(1, t("validation.titleRequired")),
    condition: z.string().min(1, t("validation.conditionRequired")),
    content: z.string(),
    category: z.string(),
    language: z.string(),
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

  const [snippets, setSnippets] = useState<CodeSnippetDraft[]>(
    initialCodeSnippets.map((s) => ({
      id: s.id,
      title: s.title,
      language: s.language,
      code: s.code,
      sortOrder: s.sortOrder,
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

  const handleAddCodeSnippet = () => {
    setSnippets((prev) => [
      ...prev,
      {
        id: `cs-${Date.now()}`,
        title: "",
        language: "typescript",
        code: "",
        sortOrder: prev.length,
        isNew: true,
        isDeleted: false,
        isDirty: true,
      },
    ]);
  };

  const handleUpdateSnippetField = (
    id: string,
    field: keyof Pick<CodeSnippetDraft, "title" | "language" | "code" | "sortOrder">,
    value: string | number
  ) => {
    setSnippets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value, isDirty: true } : s))
    );
  };

  const handleDeleteCodeSnippet = (id: string) => {
    setSnippets((prev) => prev.map((s) => (s.id === id ? { ...s, isDeleted: true } : s)));
  };

  const visibleSnippets = snippets.filter((s) => !s.isDeleted);

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
    await updateBpMutate({
      resource: ResourceName.bestPractices,
      id: bestPractice.id,
      values: { ...values, tags },
    });

    // Process checklist items
    for (const item of items) {
      if (item.isDeleted && !item.isNew) {
        await deleteMutate({ resource: ResourceName.checklistItems, id: item.id });
      } else if (item.isNew && !item.isDeleted && item.title.trim()) {
        await createMutate({
          resource: ResourceName.checklistItems,
          values: {
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
        await updateBpMutate({
          resource: ResourceName.checklistItems,
          id: item.id,
          values: {
            title: item.title.trim(),
            description: item.description,
            checkType: item.checkType,
            script: item.checkType === "script" ? item.script : null,
            sortOrder: item.sortOrder,
          },
        });
      }
    }

    // Process code snippets
    for (const snippet of snippets) {
      if (snippet.isDeleted && !snippet.isNew) {
        await deleteMutate({ resource: ResourceName.codeSnippets, id: snippet.id });
      } else if (snippet.isNew && !snippet.isDeleted && snippet.code.trim()) {
        await createMutate({
          resource: ResourceName.codeSnippets,
          values: {
            id: snippet.id,
            bestPracticeId: bestPractice.id,
            title: snippet.title,
            language: snippet.language,
            code: snippet.code,
            sortOrder: snippet.sortOrder,
          },
        });
      } else if (!snippet.isNew && !snippet.isDeleted && snippet.isDirty) {
        await updateBpMutate({
          resource: ResourceName.codeSnippets,
          id: snippet.id,
          values: {
            title: snippet.title,
            language: snippet.language,
            code: snippet.code,
            sortOrder: snippet.sortOrder,
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

            {/* Code Snippets Section */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Code2 className="h-4 w-4" />
                  {t("bestPractices.codeSnippetBtn")}
                  {visibleSnippets.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {visibleSnippets.length}
                    </span>
                  )}
                </div>
                <Button size="sm" type="button" variant="outline" onClick={handleAddCodeSnippet}>
                  <Plus className="h-3.5 w-3.5" />
                  {t("bestPractices.addCodeSnippet")}
                </Button>
              </div>

              {visibleSnippets.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {t("bestPractices.codeSnippetEmpty")}
                </p>
              ) : (
                <div className="space-y-3">
                  {visibleSnippets.map((snippet, idx) => (
                    <CodeSnippetEditor
                      key={snippet.id}
                      index={idx}
                      snippet={snippet}
                      onDelete={handleDeleteCodeSnippet}
                      onUpdate={handleUpdateSnippetField}
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
