import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@repo/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { TemplateContentTypeSchema, type SkillAnalysisResult } from "@repo/schemas";

const templateContentTypes = TemplateContentTypeSchema.options;

const outputItemSchema = z.object({
  name: z.string().min(1),
  contentType: TemplateContentTypeSchema,
});

const stepSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  suggestedOutputs: z.array(outputItemSchema),
});

const formSchema = z.object({
  steps: z.array(stepSchema).min(1),
});

export type StepFormValues = z.infer<typeof formSchema>;

export interface SkillStepListEditorProps {
  initialData: SkillAnalysisResult;
  onSubmit: (values: StepFormValues) => void;
  onSaveAsOperations: (values: StepFormValues) => void;
  onGeneratePipeline: (values: StepFormValues) => void;
  isSubmitting: boolean;
}

export const SkillStepListEditor = ({
  initialData,
  onSubmit,
  onSaveAsOperations,
  onGeneratePipeline,
  isSubmitting,
}: SkillStepListEditorProps) => {
  const { t } = useTranslation();

  const form = useForm<StepFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      steps: initialData.steps.map((s) => ({
        name: s.name,
        description: s.description,
        suggestedOutputs: s.suggestedOutputs.map((o) => ({
          name: o.name,
          contentType: o.contentType,
        })),
      })),
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const handleAddStep = () => {
    append({ name: "", description: "", suggestedOutputs: [] });
  };

  const handleAddOutput = (stepIndex: number) => {
    const current = form.getValues(`steps.${stepIndex}.suggestedOutputs`);
    form.setValue(`steps.${stepIndex}.suggestedOutputs`, [
      ...current,
      { name: "", contentType: templateContentTypes[0] },
    ]);
  };

  const handleRemoveOutput = (stepIndex: number, outputIndex: number) => {
    const current = form.getValues(`steps.${stepIndex}.suggestedOutputs`);
    form.setValue(
      `steps.${stepIndex}.suggestedOutputs`,
      current.filter((_, i) => i !== outputIndex),
    );
  };

  const handleMoveUp = (stepIndex: number) => () => move(stepIndex, stepIndex - 1);

  const handleMoveDown = (stepIndex: number) => () => move(stepIndex, stepIndex + 1);

  const handleRemoveStep = (stepIndex: number) => () => remove(stepIndex);

  const handleSaveAsOperationsClick = () => {
    onSaveAsOperations(form.getValues());
  };

  const handleGeneratePipelineClick = () => {
    onGeneratePipeline(form.getValues());
  };

  const values = form.watch();
  const isValid = values.steps.every((s) => s.name.trim().length > 0);

  return (
    <Form {...form}>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex-1 space-y-6 overflow-y-auto">
          {fields.map((field, stepIndex) => (
            <div
              key={field.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("skills.createOperation.step")} {stepIndex + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    className="h-6 w-6 p-0"
                    disabled={stepIndex === 0 || isSubmitting}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={handleMoveUp(stepIndex)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    className="h-6 w-6 p-0"
                    disabled={stepIndex === fields.length - 1 || isSubmitting}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={handleMoveDown(stepIndex)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    disabled={fields.length <= 1 || isSubmitting}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveStep(stepIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name={`steps.${stepIndex}.name`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("common.name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-8 text-sm"
                        placeholder={t("skills.createOperation.stepNamePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`steps.${stepIndex}.description`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("common.description")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none text-sm"
                        placeholder={t("skills.createOperation.stepDescriptionPlaceholder")}
                        rows={2}
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
                    className="h-6 px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => handleAddOutput(stepIndex)}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t("skills.createOperation.addOutput")}
                  </Button>
                </div>

                {form.watch(`steps.${stepIndex}.suggestedOutputs`).map((_, outputIndex) => (
                  <div key={outputIndex} className="flex gap-2 items-start">
                    <FormField
                      control={form.control}
                      name={`steps.${stepIndex}.suggestedOutputs.${outputIndex}.name`}
                      render={({ field: f }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              {...f}
                              className="h-8 text-xs"
                              placeholder={t("skills.createOperation.outputNamePlaceholder")}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`steps.${stepIndex}.suggestedOutputs.${outputIndex}.contentType`}
                      render={({ field: f }) => {
                        const handleSelectValueChange = (value: string | null) => {
                          if (value) f.onChange(value);
                        };

                        return (
                        <FormItem className="w-28">
                          <FormControl>
                            <Select value={f.value} onValueChange={handleSelectValueChange}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {templateContentTypes.map((type) => (
                                    <SelectItem key={type} className="text-xs" value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      );}}
                    />
                    <Button
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveOutput(stepIndex, outputIndex)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Button
            className="w-full h-8 text-xs"
            size="sm"
            type="button"
            variant="outline"
            onClick={handleAddStep}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t("skills.createOperation.addStep")}
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            disabled={isSubmitting || !isValid}
            size="sm"
            type="button"
            variant="outline"
            onClick={handleSaveAsOperationsClick}
          >
            {t("skills.createOperation.saveAsOperations")}
          </Button>
          <Button
            disabled={isSubmitting || !isValid}
            size="sm"
            type="button"
            onClick={handleGeneratePipelineClick}
          >
            {t("skills.createOperation.generatePipeline")}
          </Button>
        </div>
      </form>
    </Form>
  );
};
