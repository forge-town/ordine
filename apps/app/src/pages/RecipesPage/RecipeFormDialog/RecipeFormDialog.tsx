import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import type { RecipeEntity } from "@/models/daos/recipesDao";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";
import { createRecipe, updateRecipe } from "@/services/recipesService";

const formSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  description: z.string(),
  operationId: z.string().min(1, "请选择操作"),
  bestPracticeId: z.string().min(1, "请选择最佳实践"),
});

type FormValues = z.infer<typeof formSchema>;

export type RecipeFormDialogProps = {
  initial?: RecipeEntity;
  operations: OperationEntity[];
  bestPractices: BestPracticeEntity[];
  onClose: () => void;
  onSave: (r: RecipeEntity) => void;
};

export const RecipeFormDialog = ({
  initial,
  operations,
  bestPractices,
  onClose,
  onSave,
}: RecipeFormDialogProps) => {
  const { t } = useTranslation();
  const handleClose = onClose;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description,
          operationId: initial.operationId,
          bestPracticeId: initial.bestPracticeId,
        }
      : {
          name: "",
          description: "",
          operationId: "",
          bestPracticeId: "",
        },
  });

  const [operationOpen, setOperationOpen] = useState(false);
  const handleOperationOpenChange = (v: boolean) => setOperationOpen(v);
  const handleOperationToggle = () => setOperationOpen((prev) => !prev);

  const [bestPracticeOpen, setBestPracticeOpen] = useState(false);
  const handleBestPracticeOpenChange = (v: boolean) => setBestPracticeOpen(v);
  const handleBestPracticeToggle = () => setBestPracticeOpen((prev) => !prev);

  const onSubmit = async (values: FormValues) => {
    if (initial) {
      const updated = await updateRecipe({
        data: { id: initial.id, patch: values },
      });
      if (updated) onSave(updated);
    } else {
      const created = await createRecipe({
        data: {
          id: `rcp-${Date.now()}`,
          name: values.name.trim(),
          description: values.description,
          operationId: values.operationId,
          bestPracticeId: values.bestPracticeId,
        },
      });
      if (created) onSave(created);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? t("recipes.editTitle") : t("recipes.createTitle")}
          </h2>
          <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleClose}>
            <X className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <Form {...form}>
          <form className="space-y-4 overflow-y-auto p-5" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {t("recipes.nameLabel")}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("recipes.namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {t("recipes.descriptionLabel")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-none"
                      placeholder={t("recipes.descriptionPlaceholder")}
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="operationId"
              render={({ field }) => {
                const handleChange = (v: string | null) => {
                  field.onChange(v);
                  setOperationOpen(false);
                };
                return (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("recipes.operationLabel")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        open={operationOpen}
                        value={field.value}
                        onOpenChange={handleOperationOpenChange}
                        onValueChange={handleChange}
                      >
                        <SelectTrigger className="w-full" onClick={handleOperationToggle}>
                          <SelectValue placeholder={t("recipes.operationPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {operations.map((op) => (
                              <SelectItem key={op.id} value={op.id}>
                                {op.name}
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
              name="bestPracticeId"
              render={({ field }) => {
                const handleChange = (v: string | null) => {
                  field.onChange(v);
                  setBestPracticeOpen(false);
                };
                return (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("recipes.bestPracticeLabel")}
                    </FormLabel>
                    <FormControl>
                      <Select
                        open={bestPracticeOpen}
                        value={field.value}
                        onOpenChange={handleBestPracticeOpenChange}
                        onValueChange={handleChange}
                      >
                        <SelectTrigger className="w-full" onClick={handleBestPracticeToggle}>
                          <SelectValue placeholder={t("recipes.bestPracticePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {bestPractices.map((bp) => (
                              <SelectItem key={bp.id} value={bp.id}>
                                {bp.title}
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
