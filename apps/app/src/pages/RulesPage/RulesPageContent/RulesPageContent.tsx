import { useStore } from "zustand";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useNavigate } from "@tanstack/react-router";
import type { RuleRecord, RuleCategory } from "@repo/db-schema";
import { useDelete, useCustomMutation, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { useRulesPageStore } from "../_store";
import { CATEGORY_FILTERS } from "../types";
import { RuleCard } from "../RuleCard";

export const RulesPageContent = () => {
  const { result: rulesResult } = useList<RuleRecord>({ resource: ResourceName.rules });
  const rules = rulesResult?.data ?? [];
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: deleteRuleMutate } = useDelete();
  const { mutate: toggleRuleMutate } = useCustomMutation();
  const store = useRulesPageStore();
  const categoryFilter = useStore(store, (s) => s.categoryFilter);
  const search = useStore(store, (s) => s.search);
  const handleSetCategoryFilter = useStore(store, (s) => s.handleSetCategoryFilter);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);

  const handleDelete = (id: string) => {
    deleteRuleMutate({ resource: ResourceName.rules, id });
  };

  const handleToggle = (id: string, enabled: boolean) => {
    toggleRuleMutate({ url: "rules/toggle", method: "post", values: { id, enabled } });
  };

  const filtered = rules.filter((r: RuleRecord) => {
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();

      return (
        r.name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return true;
  });

  const enabledCount = rules.filter((r: RuleRecord) => r.enabled).length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSetSearch(e.target.value);

  const handleCategoryFilterClick = (value: RuleCategory | "all") => () =>
    handleSetCategoryFilter(value);

  const handleNavigateToCreate = () => void navigate({ to: "/rules/create" });

  const handleNavigateToDetail = (id: string) =>
    void navigate({ to: "/rules/$ruleId", params: { ruleId: id } });

  const handleNavigateToEdit = (id: string) =>
    void navigate({ to: "/rules/$ruleId/edit", params: { ruleId: id } });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <ShieldCheck className="mr-2 h-4 w-4 text-muted-foreground" />
        <h1 className="text-base font-semibold text-foreground">{t("rules.title")}</h1>
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {enabledCount} {t("rules.enabled")} / {rules.length} {t("common.all")}
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={handleNavigateToCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t("rules.createNew")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {CATEGORY_FILTERS.map((f) => (
              <button
                key={f.value}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  categoryFilter === f.value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={handleCategoryFilterClick(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="搜索规则名称、描述或标签…"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">{t("rules.noRules")}</p>
            <Button
              className="mt-2 h-auto p-0 text-xs"
              variant="link"
              onClick={handleNavigateToCreate}
            >
              {t("rules.createNew")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onDelete={handleDelete}
                onNavigateToDetail={handleNavigateToDetail}
                onNavigateToEdit={handleNavigateToEdit}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
