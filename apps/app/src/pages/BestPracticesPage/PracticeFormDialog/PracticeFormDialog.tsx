import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { X } from "lucide-react";
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
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import { createBestPractice, updateBestPractice } from "@/services/bestPracticesService";
import { CATEGORIES, LANGUAGES } from "../constants";

const formSchema = z.object({
  title: z.string().min(1, "标题不能为空"),
  condition: z.string().min(1, "适用时机不能为空"),
  content: z.string(),
  category: z.string(),
  language: z.string(),
  codeSnippet: z.string(),
  tags: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export type PracticeFormDialogProps = {
  initial?: BestPracticeEntity;
  onClose: () => void;
  onSave: (p: BestPracticeEntity) => void;
};

export const PracticeFormDialog = ({ initial, onClose, onSave }: PracticeFormDialogProps) => {
  const { t } = useTranslation();
  const handleClose = onClose;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          title: initial.title,
          condition: initial.condition,
          content: initial.content,
          category: initial.category,
          language: initial.language,
          codeSnippet: initial.codeSnippet,
          tags: initial.tags.join(", "),
        }
      : {
          title: "",
          condition: "",
          content: "",
          category: "general",
          language: "typescript",
          codeSnippet: "",
          tags: "",
        },
  });

  const onSubmit = async (values: FormValues) => {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (initial) {
      const updated = await updateBestPractice({
        data: {
          id: initial.id,
          patch: { ...values, tags },
        },
      });
      if (updated) onSave(updated);
    } else {
      const created = await createBestPractice({
        data: {
          id: `bp-${Date.now()}`,
          title: values.title.trim(),
          condition: values.condition.trim(),
          content: values.content,
          category: values.category,
          language: values.language,
          codeSnippet: values.codeSnippet,
          tags,
        },
      });
      onSave(created);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? t("bestPractices.editTitle") : t("bestPractices.createTitle")}
          </h2>
          <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <Form {...form}>
          <form className="space-y-4 overflow-y-auto p-5" onSubmit={form.handleSubmit(onSubmit)}>
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
                        <Select value={field.value} onValueChange={handleChange}>
                          <SelectTrigger className="w-full">
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
                  const handleChange = field.onChange;
                  return (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        {t("common.language")}
                      </FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={handleChange}>
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
                      rows={8}
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

            <div className="flex shrink-0 justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
