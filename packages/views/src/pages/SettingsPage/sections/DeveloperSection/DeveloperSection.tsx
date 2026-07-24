import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOne, useUpdate } from "@refinedev/core";
import { Input } from "@repo/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { DefaultAgentRuntimeSchema, type Settings } from "@repo/schemas";
import { SaveButton } from "../../SaveButton";
import { SectionHeader } from "../../SectionHeader";

const AGENT_RUNTIME_OPTIONS = DefaultAgentRuntimeSchema.options;

const SAVED_INDICATOR_MS = 2000;

const developerSchema = z.object({
  defaultAgentRuntime: DefaultAgentRuntimeSchema,
  defaultOutputPath: z.string(),
});

type DeveloperFormValues = z.infer<typeof developerSchema>;

export const DeveloperSection = () => {
  const { t } = useTranslation();
  const { result: settingsResult, query: settingsQuery } = useOne<Settings>({
    resource: "settings",
    id: "default",
  });
  const { mutateAsync: updateSettings } = useUpdate();
  const [saved, setSaved] = useState(false);

  const form = useForm<DeveloperFormValues>({
    resolver: zodResolver(developerSchema),
    defaultValues: {
      defaultAgentRuntime: settingsResult?.defaultAgentRuntime ?? AGENT_RUNTIME_OPTIONS[0],
      defaultOutputPath: settingsResult?.defaultOutputPath ?? "",
    },
  });

  const handleSubmit = async (values: DeveloperFormValues) => {
    await updateSettings({
      resource: "settings",
      id: "default",
      values,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), SAVED_INDICATOR_MS);
  };

  if (settingsQuery.isLoading) return null;

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <SectionHeader
          description={t("settings.developerSection.description")}
          title={t("settings.developerSection.title")}
        />
        <FormField
          control={form.control}
          name="defaultAgentRuntime"
          render={({ field }) => {
            const handleValueChange = (value: string | null) => {
              if (value) field.onChange(value);
            };

            return (
              <FormItem>
                <FormLabel>{t("settings.developerSection.defaultAgentRuntime")}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={handleValueChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {AGENT_RUNTIME_OPTIONS.map((runtime) => (
                          <SelectItem key={runtime} value={runtime}>
                            {runtime}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <FormField
          control={form.control}
          name="defaultOutputPath"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.developerSection.defaultOutputPath")}</FormLabel>
              <FormControl>
                <Input placeholder="/home/user/projects/" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <SaveButton saved={saved} onSave={form.handleSubmit(handleSubmit)} />
      </form>
    </Form>
  );
};
