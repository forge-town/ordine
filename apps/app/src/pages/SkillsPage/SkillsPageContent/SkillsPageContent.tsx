import { useState } from "react";
import { Search, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { SkillEntity } from "@/models/daos/skillsDao";
import { Route } from "@/routes/skills";

export type Skill = SkillEntity;

type SkillCategory =
  | "all"
  | "page"
  | "data"
  | "state"
  | "form"
  | "code-quality";

const categoryColors: Record<string, string> = {
  page: "bg-violet-100 text-violet-700",
  data: "bg-blue-100 text-blue-700",
  state: "bg-emerald-100 text-emerald-700",
  form: "bg-amber-100 text-amber-700",
  "code-quality": "bg-gray-100 text-gray-600",
};

export const SkillsPageContent = () => {
  const skills = Route.useLoaderData() as Skill[];
  const { t } = useTranslation();

  const categoryLabels: Record<SkillCategory, string> = {
    all: t("skills.categories.all"),
    page: t("skills.categories.page"),
    data: t("skills.categories.data"),
    state: t("skills.categories.state"),
    form: t("skills.categories.form"),
    "code-quality": t("skills.categories.code-quality"),
  };

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<SkillCategory>("all");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);
  const handleCategoryClick = (cat: SkillCategory) => () => setCategory(cat);

  const filtered = skills.filter((s) => {
    const matchesSearch =
      s.label.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || s.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">
            {t("skills.title")}
          </h1>
          <p className="text-xs text-muted-foreground">{skills.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t("common.search")}
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
            <Button
              key={cat}
              className="text-xs h-7 px-2.5"
              size="sm"
              variant={category === cat ? "default" : "ghost"}
              onClick={handleCategoryClick(cat)}
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Wand2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm">{t("skills.noSkills")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((skill) => (
              <div
                key={skill.id}
                className="group flex flex-col rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Wand2 className="h-4 w-4 text-primary" />
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px]",
                      categoryColors[skill.category] ??
                        "bg-gray-100 text-gray-600",
                    )}
                    variant="secondary"
                  >
                    {categoryLabels[skill.category as SkillCategory] ??
                      skill.category}
                  </Badge>
                </div>

                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {skill.label}
                </h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground leading-relaxed">
                  {skill.description}
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <code className="text-[10px] text-muted-foreground">
                    {skill.name}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
