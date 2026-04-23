import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { useCreate } from "@refinedev/core";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import {
  AgentRuntimeSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  type Distillation,
} from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { Button, buttonVariants } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
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
import { ResourceName } from "@/integrations/refine/dataProvider";
import { trpcClient } from "@/integrations/trpc/client";
import { Route } from "@/routes/_layout/distillations.new";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  summary: z.string(),
  sourceType: DistillationSourceTypeSchema,
  sourceId: z.string(),
  sourceLabel: z.string(),
  mode: DistillationModeSchema,
  objective: z.string(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string(),
  systemPrompt: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

type SubmissionMode = "draft" | "run";

export const DistillationStudioPage = () => {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const { mutateAsync: createDistillation } = useCreate();
  const [latestDistillation, setLatestDistillation] = useState<Distillation | null>(null);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode | null>(null);

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
      agent: undefined,
      model: "",
      systemPrompt: "",
    },
  });

  const createPayload = (values: FormValues): Distillation => ({
    id: crypto.randomUUID(),
    title: values.title.trim(),
    summary: values.summary.trim(),
    sourceType: values.sourceType,
    sourceId: values.sourceId.trim() || null,
    sourceLabel: values.sourceLabel.trim(),
    mode: values.mode,
    status: "draft",
    config: {
      objective: values.objective.trim(),
      ...(values.agent ? { agent: values.agent } : {}),
      ...(values.model.trim() ? { model: values.model.trim() } : {}),
      ...(values.systemPrompt.trim() ? { systemPrompt: values.systemPrompt.trim() } : {}),
    },
    inputSnapshot: null,
    result: null,
  });

  const onSubmit = async (values: FormValues, mode: SubmissionMode) => {
    const created = await createDistillation({
      resource: ResourceName.distillations,
      values: createPayload(values),
    });
    const draft = created.data as Distillation;

    if (mode === "draft") {
      setLatestDistillation(draft);

      return;
    }

    const executed = await trpcClient.distillations.run.mutate({ id: draft.id });
    if (executed) {
      setLatestDistillation(executed as Distillation);
    }
  };

  const isBusy = form.formState.isSubmitting;
  const completedResult =
    latestDistillation?.result?.type === "completed" ? latestDistillation.result : null;
  const failedResult =
    latestDistillation?.result?.type === "failed" ? latestDistillation.result : null;

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
            <h1 className="text-base font-semibold text-foreground">
              {t("distillations.studioTitle")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("distillations.studioSubtitle")}</p>
          </div>
        </div>
        {latestDistillation ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{latestDistillation.status}</Badge>
            <Badge variant="outline">{latestDistillation.mode}</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid max-w-7xl grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-5">
            <Form {...form}>
              <form className="space-y-4">
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="agent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.agentLabel")}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("distillations.useDefaultAgent")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="mastra">mastra</SelectItem>
                              <SelectItem value="codex">codex</SelectItem>
                              <SelectItem value="claude-code">claude-code</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("distillations.modelLabel")}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder={t("distillations.useDefaultModel")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("distillations.systemPromptLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          className="resize-none"
                          placeholder={t("distillations.systemPromptPlaceholder")}
                          rows={5}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    disabled={isBusy}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSubmissionMode("draft");
                      void form.handleSubmit((values) => onSubmit(values, "draft"))();
                    }}
                  >
                    {t("distillations.saveDraft")}
                  </Button>
                  <Button
                    disabled={isBusy}
                    type="button"
                    onClick={() => {
                      setSubmissionMode("run");
                      void form.handleSubmit((values) => onSubmit(values, "run"))();
                    }}
                  >
                    {isBusy && submissionMode === "run"
                      ? t("distillations.running")
                      : t("distillations.run")}
                  </Button>
                </div>
              </form>
            </Form>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-foreground">
                {t("distillations.resultPanelTitle")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("distillations.resultPanelHint")}
              </p>

              {latestDistillation ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{latestDistillation.status}</Badge>
                    <Badge variant="outline">{latestDistillation.mode}</Badge>
                  </div>

                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("distillations.summaryLabel")}
                    </div>
                    <p className="mt-1 text-sm text-foreground">
                      {latestDistillation.summary || "—"}
                    </p>
                  </div>

                  {completedResult ? (
                    <>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("distillations.insightsLabel")}
                        </div>
                        <div className="mt-2 space-y-2">
                          {completedResult.insights.length > 0 ? (
                            completedResult.insights.map((insight, index) => (
                              <div
                                key={`${insight}-${index}`}
                                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
                              >
                                {insight}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("distillations.minimalPathLabel")}
                        </div>
                        <div className="mt-2 space-y-2">
                          {completedResult.minimalPath.length > 0 ? (
                            completedResult.minimalPath.map((step, index) => (
                              <div
                                key={`${step}-${index}`}
                                className="rounded-lg border border-border/60 px-3 py-2 text-sm text-foreground"
                              >
                                {index + 1}. {step}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("distillations.assetsLabel")}
                        </div>
                        <div className="mt-2 space-y-2">
                          {completedResult.reusableAssets.length > 0 ? (
                            completedResult.reusableAssets.map((asset, index) => (
                              <div
                                key={`${asset.title}-${index}`}
                                className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{asset.type}</Badge>
                                  <div className="text-sm font-medium text-foreground">
                                    {asset.title}
                                  </div>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                  {asset.content}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {failedResult ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive">
                      {failedResult.error}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
                  {t("distillations.resultEmpty")}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
