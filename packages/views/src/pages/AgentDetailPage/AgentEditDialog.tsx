import { zodResolver } from "@hookform/resolvers/zod";
import { useInvalidate, useList, useUpdate } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { Agent } from "@repo/schemas";
import { AGENT_RUNTIME_ENUM, type AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { Textarea } from "@repo/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { ResourceName } from "../../constants";
import {
  agentFormSchema,
  type AgentFormValues,
  toAgentFormMutationValues,
} from "../AgentsPage/_store";

interface AgentEditDialogProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => Promise<void>;
}

export const AgentEditDialog = ({ agent, open, onOpenChange, onUpdated }: AgentEditDialogProps) => {
  const { t } = useTranslation();
  const { mutateAsync: updateAgent } = useUpdate();
  const invalidate = useInvalidate();
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: agent.name,
      description: agent.description ?? "",
      defaultRuntime: agent.defaultRuntime ?? "",
      defaultModel: agent.defaultModel ?? "",
      systemPrompt: agent.systemPrompt ?? "",
      tags: agent.tags.join(", "),
    },
  });
  const { result: runtimesResult } = useList<AgentRuntimeConfig>({
    resource: ResourceName.agentRuntimes,
  });
  const selectedRuntime = runtimesResult.data.find(
    (runtime) => runtime.type === form.watch("defaultRuntime"),
  );
  const modelOptions =
    selectedRuntime?.connection.mode === "local" ? (selectedRuntime.connection.models ?? []) : [];

  const handleSubmit = async (values: AgentFormValues) => {
    await updateAgent({
      resource: ResourceName.agents,
      id: agent.id,
      values: toAgentFormMutationValues(values),
    });
    await invalidate({
      resource: ResourceName.agents,
      id: agent.id,
      invalidates: ["detail", "list"],
    });
    await onUpdated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("agents.editTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agents.form.name")}</FormLabel>
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
                    <FormLabel>{t("agents.form.description")}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t("agents.form.descriptionPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultRuntime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agents.form.defaultRuntime")}</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(AGENT_RUNTIME_ENUM).map((runtime) => (
                          <Button
                            key={runtime}
                            className={cn(
                              "justify-start",
                              field.value === runtime && "border-primary bg-primary/5",
                            )}
                            type="button"
                            variant="outline"
                            onClick={() => field.onChange(runtime)}
                          >
                            {runtime}
                          </Button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agents.form.systemPrompt")}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="font-mono"
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
                name="defaultModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agents.form.defaultModel")}</FormLabel>
                    <Select
                      value={field.value || "__default__"}
                      onValueChange={(value) =>
                        field.onChange(value === "__default__" ? "" : value)
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              modelOptions.length > 0
                                ? t("agents.form.defaultModelPlaceholder")
                                : t("localAgents.modelsNotDetected")
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__default__">
                          {t("agents.form.runtimeDefaultModel")}
                        </SelectItem>
                        {modelOptions.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agents.form.tags")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("agents.form.tagsPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("agents.form.cancel")}
              </Button>
              <Button type="submit">{t("agents.form.save")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
