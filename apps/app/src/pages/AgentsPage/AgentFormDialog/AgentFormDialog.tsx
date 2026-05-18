import { useForm } from "react-hook-form";
import { useCreate, useUpdate } from "@refinedev/core";
import { Terminal, Cpu, Zap, Cog } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import { AGENT_RUNTIME_ENUM } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { type AgentFormValues, toAgentFormMutationValues, useAgentsPageStore } from "../_store";

const RUNTIME_META: Record<string, { label: string; icon: React.ReactNode; description: string }> =
  {
    [AGENT_RUNTIME_ENUM.CLAUDE_CODE]: {
      label: "Claude Code",
      icon: <Terminal className="h-4 w-4" />,
      description: "Anthropic CLI agent",
    },
    [AGENT_RUNTIME_ENUM.CODEX]: {
      label: "Codex",
      icon: <Cpu className="h-4 w-4" />,
      description: "OpenAI Codex CLI",
    },
    [AGENT_RUNTIME_ENUM.MASTRA]: {
      label: "Mastra",
      icon: <Zap className="h-4 w-4" />,
      description: "Mastra framework",
    },
    [AGENT_RUNTIME_ENUM.OPENCLAW]: {
      label: "OpenClaw",
      icon: <Cog className="h-4 w-4" />,
      description: "OpenClaw runtime",
    },
  };

export const AgentFormDialog = () => {
  const { t } = useTranslation();
  const store = useAgentsPageStore();
  const editing = useStore(store, (s) => s.editing);
  const agentFormControl = useStore(store, (s) => s.agentFormControl);
  const handleDialogOpenChange = useStore(store, (s) => s.handleDialogOpenChange);
  const handleCancelButtonClick = useStore(store, (s) => s.handleCancelButtonClick);
  const handleFormSubmitSuccess = useStore(store, (s) => s.handleFormSubmitSuccess);
  const { mutateAsync: createAgent } = useCreate();
  const { mutateAsync: updateAgent } = useUpdate();
  const form = useForm<AgentFormValues>({
    formControl: agentFormControl.formControl,
  });

  const runtimeOptions = Object.values(AGENT_RUNTIME_ENUM);
  const handleFormSubmit = async (values: AgentFormValues) => {
    const mutationValues = toAgentFormMutationValues(values);
    if (editing) {
      await updateAgent({
        resource: ResourceName.agents,
        id: editing.id,
        values: mutationValues,
      });
      handleFormSubmitSuccess();

      return;
    }

    await createAgent({
      resource: ResourceName.agents,
      values: {
        id: crypto.randomUUID(),
        ...mutationValues,
        capabilities: [],
        allowedTools: [],
        allowedSkillIds: [],
      },
    });
    handleFormSubmitSuccess();
  };

  return (
    <Dialog open onOpenChange={handleDialogOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("agents.editTitle") : t("agents.createTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={form.handleSubmit(handleFormSubmit)}
          >
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
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
                  const handleRuntimeSelect = (value: string) => {
                    field.onChange(field.value === value ? "" : value);
                  };

                  return (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">
                        {t("agents.form.defaultRuntime")}
                      </FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-2">
                          {runtimeOptions.map((rt) => {
                            const meta = RUNTIME_META[rt];
                            const isSelected = field.value === rt;

                            return (
                              <Button
                                key={rt}
                                className={cn(
                                  "flex h-auto items-center justify-start gap-2.5 p-3 text-left",
                                  isSelected &&
                                    "border-primary bg-primary/5 ring-1 ring-primary/20",
                                )}
                                type="button"
                                variant={isSelected ? "outline" : "outline"}
                                onClick={() => handleRuntimeSelect(rt)}
                              >
                                <div
                                  className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                    isSelected
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {meta?.icon ?? <Cpu className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-medium">
                                    {meta?.label ?? rt}
                                  </div>
                                  <div className="truncate text-[10px] text-muted-foreground">
                                    {meta?.description ?? rt}
                                  </div>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </FormControl>
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
            </div>

            <DialogFooter>
              <Button size="sm" type="button" variant="outline" onClick={handleCancelButtonClick}>
                {t("agents.form.cancel")}
              </Button>
              <Button size="sm" type="submit">
                {editing ? t("agents.form.save") : t("agents.form.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
