import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useCreate, useOne } from "@refinedev/core";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Skeleton } from "@repo/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { TEMPLATE_CONTENT_TYPE_ENUM } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";

const outputItemSchema = z.object({
  name: z.string().min(1),
  contentType: z.enum([
    TEMPLATE_CONTENT_TYPE_ENUM.MARKDOWN,
    TEMPLATE_CONTENT_TYPE_ENUM.JSON,
    TEMPLATE_CONTENT_TYPE_ENUM.YAML,
    TEMPLATE_CONTENT_TYPE_ENUM.TEXT,
    TEMPLATE_CONTENT_TYPE_ENUM.HTML,
    TEMPLATE_CONTENT_TYPE_ENUM.XML,
    TEMPLATE_CONTENT_TYPE_ENUM.CSV,
  ]),
});

const formSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  outputs: z.array(outputItemSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface DraftOperation {
  name: string;
  description: string;
  sourceSkillId: string;
  config: {
    executor: { type: string; agentMode: string; skillId: string };
    inputs: never[];
    outputs: never[];
  };
  acceptedObjectTypes: readonly string[];
}

export interface SkillToOperationDialogProps {
  open: boolean;
  skillId: string | null;
  onClose: () => void;
}

export const SkillToOperationDialog = ({
  open,
  skillId,
  onClose,
}: SkillToOperationDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: createOperation } = useCreate();

  const { result: draftResult, query: draftQuery } = useOne<DraftOperation>({
    resource: ResourceName.skillDraftOperations,
    id: skillId ?? "",
    queryOptions: {
      enabled: open && !!skillId,
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      outputs: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "outputs",
  });

  useEffect(() => {
    if (draftResult) {
      form.reset({
        name: draftResult.name,
        description: draftResult.description ?? "",
        outputs: [],
      });
    }
  }, [draftResult, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
    }
  };

  const handleAddOutput = () => {
    append({ name: "", contentType: TEMPLATE_CONTENT_TYPE_ENUM.MARKDOWN });
  };

  const handleSubmit = async (values: FormValues) => {
    if (!draftResult || !skillId) return;

    const result = await createOperation({
      resource: ResourceName.operations,
      values: {
        id: crypto.randomUUID(),
        name: values.name,
        description: values.description,
        config: {
          ...draftResult.config,
          outputs: values.outputs.map((o) => ({ ...o, templateIds: [] })),
        },
        acceptedObjectTypes: draftResult.acceptedObjectTypes,
        sourceSkillId: skillId,
      },
    });

    toastStore.getState().addToast({
      type: "success",
      title: t("skills.createOperation.success"),
    });

    onClose();

    const newOperationId = (result.data as { id: string }).id;
    void navigate({
      to: "/pipelines/operations/$operationId",
      params: { operationId: newOperationId },
    });
  };

  const isLoading = draftQuery?.isLoading;
  const isBusy = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("skills.createOperation.dialogTitle")}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <Form {...form}>
            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <div className="flex-1 space-y-4 overflow-y-auto">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        {t("common.name")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("skills.createOperation.namePlaceholder")}
                          {...field}
                        />
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
                        {t("common.description")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none"
                          placeholder={t("skills.createOperation.descriptionPlaceholder")}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("skills.createOperation.outputs")}
                    </span>
                    <Button
                      size="sm"
                      type="button"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={handleAddOutput}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {t("skills.createOperation.addOutput")}
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name={`outputs.${index}.name`}
                        render={({ field: f }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input className="h-8 text-xs" placeholder="output name" {...f} />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`outputs.${index}.contentType`}
                        render={({ field: f }) => {
                          const handleValueChange = (value: string | null) => {
                            if (value) f.onChange(value);
                          };

                          return (
                            <FormItem className="w-28">
                              <FormControl>
                                <Select value={f.value} onValueChange={handleValueChange}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {Object.values(TEMPLATE_CONTENT_TYPE_ENUM).map((type) => (
                                        <SelectItem key={type} value={type} className="text-xs">
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                            </FormItem>
                          );
                        }}
                      />
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={onClose}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {t("skills.createOperation.confirm")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
