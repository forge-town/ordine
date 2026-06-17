import { Controller, type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/form";
import type { EditFormValues } from "./editFormSchema";

const TEXT_FIELDS = [
  { name: "repo", placeholder: "forge-town/ui-kit · ~/out" },
  { name: "branch", placeholder: "main" },
  { name: "subPath", placeholder: "components/bifrost" },
  { name: "commitMessage", placeholder: "Publish generated components" },
] as const;

/** publish 执行器配置子表单（绑定 OperationEditForm 的 react-hook-form）。 */
export const PublishConfigFields = ({ control }: { control: Control<EditFormValues> }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4" data-testid="publish-config">
      <Controller
        control={control}
        name="publishTarget"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-muted-foreground">
              {t("operations.publish.target")}
            </FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-10 w-full" data-testid="publish-config-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">{t("operations.publish.targetGit")}</SelectItem>
                  <SelectItem value="localDir">{t("operations.publish.targetLocalDir")}</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )}
      />

      {TEXT_FIELDS.map(({ name, placeholder }) => (
        <FormField
          key={name}
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-muted-foreground">
                {t(`operations.publish.${name}`)}
              </FormLabel>
              <FormControl>
                <Input
                  className="h-10 text-sm"
                  data-testid={`publish-config-${name}`}
                  placeholder={placeholder}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      ))}

      <Controller
        control={control}
        name="openPr"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-muted-foreground">
              {t("operations.publish.openPr")}
            </FormLabel>
            <FormControl>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                data-testid="publish-config-openPr"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  "flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm",
                  field.value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                <span>{t("operations.publish.openPrHint")}</span>
                <span className="text-xs font-medium">
                  {field.value ? t("operations.publish.on") : t("operations.publish.off")}
                </span>
              </button>
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
