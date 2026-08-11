import { useCallback } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod/v4";
import { RefreshCw, Save, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOne, useCustomMutation } from "@refinedev/core";
import { Button } from "@repo/ui/button";
import { surfaceCardVariants } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/select";
import { Separator } from "@repo/ui/separator";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@repo/ui/form";
import {
  AgentRuntimeSchema,
  AgentRuntimeConfigSchema,
  type AgentRuntimeConfig,
} from "@repo/schemas";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { RuntimeIcon } from "../../../pages/RuntimesPage/RuntimeIcon";

const AGENT_TYPE_OPTIONS = AgentRuntimeSchema.options;
const CONNECTION_MODES = ["local", "ssh"] as const;

const s = "runtimes";

const editFormSchema = AgentRuntimeConfigSchema;
type EditFormValues = z.infer<typeof editFormSchema>;

export const RuntimeEditPageContent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runtimeId } = useParams({ strict: false }) as { runtimeId: string };
  const { result, query: runtimeQuery } = useOne<AgentRuntimeConfig>({
    resource: "agentRuntimes",
    id: runtimeId,
  });
  const { mutateAsync: syncAll } = useCustomMutation();

  const runtime = result;

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: runtime ? structuredClone(runtime) : undefined,
    values: runtime ? structuredClone(runtime) : undefined,
  });

  const connectionMode = form.watch("connection.mode");

  const handleSubmit = useCallback(
    async (values: EditFormValues) => {
      await syncAll({
        url: "agentRuntimes/syncAll",
        method: "post",
        values: { runtimes: [values] },
      });
      navigate({ to: "/runtimes/$runtimeId", params: { runtimeId } });
    },
    [syncAll, navigate, runtimeId],
  );

  const handleConnectionModeChange = useCallback(
    (mode: string | null) => {
      if (!mode) return;
      if (mode === "local") {
        form.setValue("connection", { mode: "local" }, { shouldDirty: true });
      } else {
        form.setValue("connection", { mode: "ssh", host: "", user: "" }, { shouldDirty: true });
      }
    },
    [form],
  );

  if (runtimeQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          backTo={`/runtimes/${runtimeId}`}
          icon={<Server className="h-4 w-4 text-primary" />}
          title={t(`${s}.title`)}
        />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader backTo="/runtimes" title={t(`${s}.title`)} />
        <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
          <div>
            <Server className="mx-auto size-8 text-muted-foreground/25" />
            <p className="mt-2 text-sm font-medium text-foreground">{t("common.notFound")}</p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => runtimeQuery.refetch()}
            >
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleFormSubmit = form.handleSubmit(handleSubmit);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button disabled={!form.formState.isDirty} size="sm" onClick={handleFormSubmit}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {t(`${s}.save`)}
            </Button>
          </div>
        }
        backTo={`/runtimes/${runtimeId}`}
        icon={<RuntimeIcon className="h-4 w-4" type={runtime.type} />}
        title={`${t(`${s}.edit`)} — ${runtime.name || t(`${s}.unnamed`)}`}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        <div className={cn(surfaceCardVariants(), "mx-auto max-w-3xl p-4 sm:p-5")}>
          <Form {...form}>
            <form className="space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`${s}.name`)}</FormLabel>
                    <FormControl>
                      <Input placeholder={t(`${s}.namePlaceholder`)} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => {
                    const handleTypeChange = (value: string | null) => {
                      if (value) field.onChange(value);
                    };

                    return (
                      <FormItem>
                        <FormLabel>{t(`${s}.type`)}</FormLabel>
                        <Select value={field.value} onValueChange={handleTypeChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectGroup>
                              {AGENT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
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
                  name="connection.mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`${s}.connectionMode`)}</FormLabel>
                      <Select value={field.value} onValueChange={handleConnectionModeChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            {CONNECTION_MODES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {t(`${s}.${m}`)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {connectionMode === "ssh" && (
                <>
                  <Separator />
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t(`${s}.sshConfig`)}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="connection.host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t(`${s}.host`)}</FormLabel>
                          <FormControl>
                            <Input placeholder={t(`${s}.hostPlaceholder`)} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="connection.user"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t(`${s}.user`)}</FormLabel>
                          <FormControl>
                            <Input placeholder={t(`${s}.userPlaceholder`)} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="connection.port"
                      render={({ field }) => {
                        const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                          field.onChange(e.target.value ? Number(e.target.value) : undefined);
                        };

                        return (
                          <FormItem>
                            <FormLabel>{t(`${s}.port`)}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="22"
                                type="number"
                                value={field.value ?? ""}
                                onChange={handlePortChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="connection.keyPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t(`${s}.keyPath`)}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(`${s}.keyPathPlaceholder`)}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
