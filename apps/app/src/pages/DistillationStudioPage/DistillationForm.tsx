import { zodResolver } from "@hookform/resolvers/zod";
import { useCreate, useCustomMutation, useOne, useUpdate } from "@refinedev/core";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { z } from "zod/v4";
import {
  AgentRuntimeSchema,
  DistillationModeSchema,
  DistillationSourceTypeSchema,
  type Distillation,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
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
import { Route } from "@/routes/_layout/distillation-studio";
import { useDistillationStudioPageStore } from "./_store";

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

const buildFormValues = ({
  distillation,
  fallbackTitle,
  search,
}: {
  distillation?: Distillation | null;
  fallbackTitle: string;
  search: ReturnType<typeof Route.useSearch>;
}): FormValues => {
  if (distillation) {
    return {
      title: distillation.title,
      summary: distillation.summary,
      sourceType: distillation.sourceType,
      sourceId: distillation.sourceId ?? "",
      sourceLabel: distillation.sourceLabel,
      mode: distillation.mode,
      objective: distillation.config.objective ?? "",
      agent: distillation.config.agent,
      model: distillation.config.model ?? "",
      systemPrompt: distillation.config.systemPrompt ?? "",
    };
  }

  return {
    title: fallbackTitle,
    summary: "",
    sourceType: search.sourceType ?? "manual",
    sourceId: search.sourceId ?? "",
    sourceLabel: search.sourceLabel ?? "",
    mode: search.mode ?? "pipeline",
    objective: "",
    agent: undefined,
    model: "",
    systemPrompt: "",
  };
};

const buildDistillationPayload = (values: FormValues) => ({
  title: values.title.trim(),
  summary: values.summary.trim(),
  sourceType: values.sourceType,
  sourceId: values.sourceId.trim() || null,
  sourceLabel: values.sourceLabel.trim(),
  mode: values.mode,
  config: {
    objective: values.objective.trim(),
    ...(values.agent ? { agent: values.agent } : {}),
    ...(values.model.trim() ? { model: values.model.trim() } : {}),
    ...(values.systemPrompt.trim() ? { systemPrompt: values.systemPrompt.trim() } : {}),
  },
});

export const DistillationForm = () => {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const existingDistillationId = search.distillationId ?? "";

  const store = useDistillationStudioPageStore();
  const submissionMode = useStore(store, (s) => s.submissionMode);
  const setLatestDistillation = useStore(store, (s) => s.handleSetLatestDistillation);
  const setSubmissionMode = useStore(store, (s) => s.handleSetSubmissionMode);
  const setCurrentSourceType = useStore(store, (s) => s.handleSetCurrentSourceType);
  const setCurrentSourceId = useStore(store, (s) => s.handleSetCurrentSourceId);

  const { mutateAsync: createDistillation } = useCreate();
  const { mutateAsync: updateDistillation } = useUpdate();
  const { mutateAsync: runDistillation } = useCustomMutation();
  const { result: existingDistillationResult } = useOne<Distillation>({
    resource: ResourceName.distillations,
    id: existingDistillationId,
    queryOptions: { enabled: !!existingDistillationId },
  });

  const initialTitle = useMemo(() => {
    if (search.sourceLabel) {
      return `${t("distillations.defaultTitlePrefix")} ${search.sourceLabel}`;
    }

    return t("distillations.defaultUntitled");
  }, [search.sourceLabel, t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: buildFormValues({ fallbackTitle: initialTitle, search }),
  });

  useEffect(() => {
    if (!existingDistillationResult) {
      return;
    }

    form.reset(
      buildFormValues({
        distillation: existingDistillationResult,
        fallbackTitle: initialTitle,
        search,
      }),
    );
    setLatestDistillation(existingDistillationResult);
  }, [existingDistillationResult, form, initialTitle, search, setLatestDistillation]);

  const currentSourceType = form.watch("sourceType");
  const currentSourceId = form.watch("sourceId");

  useEffect(() => {
    setCurrentSourceType(currentSourceType);
  }, [currentSourceType, setCurrentSourceType]);

  useEffect(() => {
    setCurrentSourceId(currentSourceId.trim());
  }, [currentSourceId, setCurrentSourceId]);

  const persistDistillation = async (values: FormValues, mode: SubmissionMode) => {
    const payload = buildDistillationPayload(values);

    if (existingDistillationId) {
      const updated = await updateDistillation({
        resource: ResourceName.distillations,
        id: existingDistillationId,
        values:
          mode === "run"
            ? {
                ...payload,
                status: "draft",
                inputSnapshot: null,
                result: null,
              }
            : payload,
      });

      return updated.data as Distillation;
    }

    const created = await createDistillation({
      resource: ResourceName.distillations,
      values: {
        id: crypto.randomUUID(),
        ...payload,
        status: "draft",
        inputSnapshot: null,
        result: null,
      },
    });

    return created.data as Distillation;
  };

  const onSubmit = async (values: FormValues, mode: SubmissionMode) => {
    const draft = await persistDistillation(values, mode);

    if (mode === "draft") {
      setLatestDistillation(draft);

      return;
    }

    const executed = await runDistillation({
      url: "distillations/run",
      method: "post",
      values: { id: draft.id },
    });
    if (executed?.data) {
      setLatestDistillation(executed.data as Distillation);
    }
  };

  const isBusy = form.formState.isSubmitting;
  const handleSubmitDraft = () => {
    setSubmissionMode("draft");
    void form.handleSubmit((values) => onSubmit(values, "draft"))();
  };
  const handleSubmitRun = () => {
    setSubmissionMode("run");
    void form.handleSubmit((values) => onSubmit(values, "run"))();
  };

  return (
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
              render={({ field }) => {
                const handleSourceTypeChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.sourceType")}</FormLabel>
                    <Select value={field.value} onValueChange={handleSourceTypeChange}>
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
                );
              }}
            />

            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => {
                const handleModeChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.modeLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={handleModeChange}>
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
                );
              }}
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
              render={({ field }) => {
                const handleAgentChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.agentLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={handleAgentChange}>
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
                );
              }}
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
              onClick={handleSubmitDraft}
            >
              {existingDistillationId
                ? t("distillations.saveChanges")
                : t("distillations.saveDraft")}
            </Button>
            <Button disabled={isBusy} type="button" onClick={handleSubmitRun}>
              {isBusy && submissionMode === "run"
                ? t("distillations.running")
                : existingDistillationId
                  ? t("distillations.rerun")
                  : t("distillations.run")}
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
};
