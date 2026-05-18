// Bootstrap pattern: URL search params → slice handleLoadDistillation.
// Infrastructure limitation: the slice (and its formControl) lives inside
// DistillationStudioPageStoreProvider, which is mounted deeper in the tree
// than TanStack Router's route loader. Therefore we cannot move this
// initialization into the route loader and must keep the useEffect here.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useCreate, useCustomMutation, useUpdate } from "@refinedev/core";
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
import { AgentRuntimeSchema, type Distillation } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/distillation-studio";
import {
  buildDistillationPayload,
  type DistillationFormValues,
  type DistillationSubmitDependencies,
  useDistillationStudioPageStore,
} from "./_store";

interface DistillationFormProps {
  existingDistillation: Distillation | null;
}

export const DistillationForm = ({ existingDistillation }: DistillationFormProps) => {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const existingDistillationId = search.distillationId ?? "";

  const store = useDistillationStudioPageStore();
  const submissionMode = useStore(store, (s) => s.submissionMode);
  const distillationFormControl = useStore(store, (s) => s.distillationFormControl);
  const handleLoadDistillation = useStore(store, (s) => s.handleLoadDistillation);
  const handleSaveDraftButtonClick = useStore(store, (s) => s.handleSaveDraftButtonClick);
  const handleRunButtonClick = useStore(store, (s) => s.handleRunButtonClick);
  const { mutateAsync: createDistillation } = useCreate();
  const { mutateAsync: updateDistillation } = useUpdate();
  const { mutateAsync: runDistillation } = useCustomMutation();

  const form = useForm<DistillationFormValues>({
    formControl: distillationFormControl.formControl,
  });

  const submitDependencies: DistillationSubmitDependencies = {
    persistDistillation: async ({ values, mode, existingDistillationId }) => {
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
    },
    runDistillation: async (distillationId) => {
      const executed = await runDistillation({
        url: "distillations/run",
        method: "post",
        values: { id: distillationId },
      });

      return (executed.data ?? null) as Distillation | null;
    },
  };

  useEffect(() => {
    const fallbackTitle = search.sourceLabel
      ? `${t("distillations.defaultTitlePrefix")} ${search.sourceLabel}`
      : t("distillations.defaultUntitled");
    handleLoadDistillation(
      {
        distillationId: existingDistillationId,
        fallbackTitle,
        searchSourceType: search.sourceType,
        searchSourceId: search.sourceId,
        searchSourceLabel: search.sourceLabel,
        searchMode: search.mode,
      },
      existingDistillation,
    );
  }, [
    existingDistillationId,
    existingDistillation,
    handleLoadDistillation,
    search.sourceType,
    search.sourceId,
    search.sourceLabel,
    search.mode,
    t,
  ]);

  const isBusy = form.formState.isSubmitting;
  const handleSaveButtonClick = () => {
    void handleSaveDraftButtonClick(existingDistillationId, submitDependencies);
  };
  const handleRunSubmitButtonClick = () => {
    void handleRunButtonClick(existingDistillationId, submitDependencies);
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
                const handleSourceTypeSelectChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.sourceType")}</FormLabel>
                    <Select value={field.value} onValueChange={handleSourceTypeSelectChange}>
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
                const handleModeSelectChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.modeLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={handleModeSelectChange}>
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
                const handleAgentSelectChange = field.onChange;

                return (
                  <FormItem>
                    <FormLabel>{t("distillations.agentLabel")}</FormLabel>
                    <Select value={field.value} onValueChange={handleAgentSelectChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("distillations.useDefaultAgent")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {AgentRuntimeSchema.options.map((agent) => (
                            <SelectItem key={agent} value={agent}>
                              {agent}
                            </SelectItem>
                          ))}
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
              onClick={handleSaveButtonClick}
            >
              {existingDistillationId
                ? t("distillations.saveChanges")
                : t("distillations.saveDraft")}
            </Button>
            <Button disabled={isBusy} type="button" onClick={handleRunSubmitButtonClick}>
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
