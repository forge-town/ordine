import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCreate } from "@refinedev/core";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import {
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  type Distillation,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { buttonVariants } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
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
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/form";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/distillations.new";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  summary: z.string(),
  sourceType: DistillationSourceTypeSchema,
  sourceId: z.string(),
  sourceLabel: z.string(),
  mode: DistillationModeSchema,
  objective: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export const DistillationStudioPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { mutateAsync: createDistillation } = useCreate();

  const initialTitle = useMemo(() => {
    if (search.sourceLabel) {
      return `${t("distillations.defaultTitlePrefix")} ${search.sourceLabel}`;
    }

    return t("distillations.defaultUntitled");
  }, [search.sourceLabel, t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialTitle,
      summary: "",
      sourceType: search.sourceType ?? "manual",
      sourceId: search.sourceId ?? "",
      sourceLabel: search.sourceLabel ?? "",
      mode: search.mode ?? "pipeline",
      objective: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload: Distillation = {
      id: `dst-${Date.now()}`,
      title: values.title.trim(),
      summary: values.summary.trim(),
      sourceType: values.sourceType,
      sourceId: values.sourceId.trim() || null,
      sourceLabel: values.sourceLabel.trim(),
      mode: values.mode,
      status: "draft",
      config: {
        objective: values.objective.trim(),
      },
      inputSnapshot: {
        sourceType: values.sourceType,
        sourceId: values.sourceId.trim() || null,
        sourceLabel: values.sourceLabel.trim(),
      },
      result: null,
    };

    await createDistillation({
      resource: ResourceName.distillations,
      values: payload,
    });

    void navigate({ to: "/distillations" });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div className="flex items-center gap-3">
          <Link
            className={buttonVariants({ className: "h-8 w-8", size: "icon", variant: "ghost" })}
            to="/distillations"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-foreground">{t("distillations.studioTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t("distillations.studioSubtitle")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card className="p-5">
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("distillations.titleLabel")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sourceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.sourceType")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="job">job</SelectItem>
                              <SelectItem value="pipeline">pipeline</SelectItem>
                              <SelectItem value="manual">manual</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.modeLabel")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="pipeline">pipeline</SelectItem>
                              <SelectItem value="failure">failure</SelectItem>
                              <SelectItem value="prompt">prompt</SelectItem>
                              <SelectItem value="knowledge">knowledge</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="sourceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.sourceId")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sourceLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.sourceLabel")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="summary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("distillations.summaryLabel")}</FormLabel>
                      <FormControl>
                        <Textarea className="resize-none" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("distillations.objectiveLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none"
                          placeholder={t("distillations.objectivePlaceholder")}
                          rows={6}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Link className={buttonVariants({ variant: "outline" })} to="/distillations">
                    {t("common.cancel")}
                  </Link>
                  <Button disabled={form.formState.isSubmitting} type="submit">
                    {form.formState.isSubmitting ? t("common.saving") : t("distillations.saveDraft")}
                  </Button>
                </div>
              </form>
            </Form>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {t("distillations.previewTitle")}
                </h2>
                <p className="text-xs text-muted-foreground">{t("distillations.previewHint")}</p>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs text-foreground">
              {JSON.stringify(
                {
                  title: form.watch("title"),
                  sourceType: form.watch("sourceType"),
                  sourceId: form.watch("sourceId") || null,
                  sourceLabel: form.watch("sourceLabel"),
                  mode: form.watch("mode"),
                  summary: form.watch("summary"),
                  config: {
                    objective: form.watch("objective"),
                  },
                },
                null,
                2,
              )}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
};
