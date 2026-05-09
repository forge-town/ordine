import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
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
import { type Agent, AGENT_RUNTIME_ENUM } from "@repo/schemas";
import { useCreate, useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useAgentsPageStore } from "../_store";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  defaultRuntime: z.string(),
  systemPrompt: z.string(),
  tags: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export type AgentFormDialogProps = {
  initial?: Agent;
};

export const AgentFormDialog = ({ initial }: AgentFormDialogProps) => {
  const { t } = useTranslation();
  const store = useAgentsPageStore();
  const handleSetShowForm = useStore(store, (s) => s.handleSetShowForm);
  const handleSetEditing = useStore(store, (s) => s.handleSetEditing);
  const handleClose = () => {
    handleSetShowForm(false);
    handleSetEditing(null);
  };
  const { mutateAsync: createMutate } = useCreate();
  const { mutateAsync: updateMutate } = useUpdate();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          description: initial.description ?? "",
          defaultRuntime: initial.defaultRuntime ?? "",
          systemPrompt: initial.systemPrompt ?? "",
          tags: initial.tags.join(", "),
        }
      : {
          name: "",
          description: "",
          defaultRuntime: "",
          systemPrompt: "",
          tags: "",
        },
  });

  const onSubmit = async (values: FormValues) => {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (initial) {
      await updateMutate({
        resource: ResourceName.agents,
        id: initial.id,
        values: {
          name: values.name.trim(),
          description: values.description || null,
          defaultRuntime: values.defaultRuntime || null,
          systemPrompt: values.systemPrompt || null,
          tags,
        },
      });
    } else {
      await createMutate({
        resource: ResourceName.agents,
        values: {
          id: crypto.randomUUID(),
          name: values.name.trim(),
          description: values.description || null,
          defaultRuntime: values.defaultRuntime || null,
          systemPrompt: values.systemPrompt || null,
          capabilities: [],
          allowedTools: [],
          allowedSkillIds: [],
          tags,
        },
      });
    }
    handleClose();
  };

  const runtimeOptions = Object.values(AGENT_RUNTIME_ENUM);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            {initial ? t("agents.editTitle") : t("agents.createTitle")}
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
                    {t("agents.form.name")}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("agents.form.namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {t("agents.form.description")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[60px] resize-none"
                      placeholder={t("agents.form.descriptionPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultRuntime"
              render={({ field }) => {
                const handleChange = (v: string | null) => {
                  field.onChange(v ?? "");
                };

                return (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-muted-foreground">
                      {t("agents.form.defaultRuntime")}
                    </FormLabel>
                    <Select value={field.value} onValueChange={handleChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("agents.form.runtimePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          {runtimeOptions.map((rt) => (
                            <SelectItem key={rt} value={rt}>
                              {rt}
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
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {t("agents.form.systemPrompt")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[80px] resize-none font-mono text-xs"
                      placeholder={t("agents.form.systemPromptPlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-muted-foreground">
                    {t("agents.form.tags")}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("agents.form.tagsPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" type="button" variant="outline" onClick={handleClose}>
                {t("agents.form.cancel")}
              </Button>
              <Button size="sm" type="submit">
                {initial ? t("agents.form.save") : t("agents.form.create")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
