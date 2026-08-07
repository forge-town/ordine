import { useMemo, useState, type ChangeEvent } from "react";
import { Download, Plus, Search, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useCreate, useDataProvider, useDelete, useList } from "@refinedev/core";
import type { Skill } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../../constants";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { SKILL_SOURCE_FILTERS, type SkillSourceFilter, useSkillsPageStore } from "../_store";
import { SkillCard, type SkillCardItem } from "../SkillCard";

interface SkillImportCandidate {
  id: string;
  name: string;
  label: string;
  description: string;
  path: string;
}

interface SkillImportPreview {
  candidates: SkillImportCandidate[];
  errors: string[];
}

const IO_BY_CATEGORY: Record<string, string> = {
  custom: "prompt -> custom operation",
  data: "schema -> dao / service",
  form: "fields -> validated form",
  imported: "prompt -> artifact",
  page: "brief -> page.tsx",
  state: "state map -> zustand slice",
  "code-quality": "repo -> review report",
};

const SOURCE_TONES: Record<string, SkillCardItem["sourceTone"]> = {
  "Built-in": "neutral",
  "Claude Code": "orange",
  Codex: "blue",
  Custom: "green",
  Hermes: "purple",
  Imported: "neutral",
};

const normalizeToken = (value: string) => value.trim().toLowerCase();
const includesAny = (values: string[], needles: string[]) =>
  values.some((value) => needles.some((needle) => value.includes(needle)));
const getSkillTokens = (skill: Skill) =>
  [skill.name, skill.label, skill.category, ...skill.tags].map(normalizeToken);

const getSkillSource = (skill: Skill): SkillSourceFilter => {
  const tokens = getSkillTokens(skill);
  if (includesAny(tokens, ["claude-code", "claude code", "claude"])) return "Claude Code";
  if (includesAny(tokens, ["codex"])) return "Codex";
  if (includesAny(tokens, ["hermes"])) return "Hermes";
  if (skill.category === "imported" || tokens.includes("imported")) return "Imported";
  if (skill.category === "custom" || tokens.includes("custom")) return "Custom";

  return "Built-in";
};

const getSourceCaption = (source: SkillSourceFilter) => {
  if (source === "Built-in") return "seeded in Ordine";
  if (source === "Custom") return "created locally";
  if (source === "All") return "available everywhere";

  return `imported from ${source}`;
};

const toSkillCardItem = (skill: Skill): SkillCardItem => {
  const source = getSkillSource(skill);
  const title = skill.label.trim() || skill.name;

  return {
    id: skill.id,
    description: skill.description.split("\n")[0] || "No description yet.",
    io: IO_BY_CATEGORY[skill.category] ?? "input -> output",
    name: skill.name,
    operation: `${title} Operation`,
    source,
    sourceCaption: getSourceCaption(source),
    sourceTone: SOURCE_TONES[source] ?? "neutral",
    tags: skill.tags,
    title,
  };
};

export const SkillsPageContent = () => {
  const { t } = useTranslation();
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();
  const skills = skillsResult.data;
  const [importPath, setImportPath] = useState("");
  const [importCandidates, setImportCandidates] = useState<SkillImportCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", label: "", description: "" });
  const { mutateAsync: createSkill } = useCreate();
  const { mutateAsync: deleteSkill } = useDelete();
  const store = useSkillsPageStore();
  const search = useStore(store, (state) => state.search);
  const source = useStore(store, (state) => state.source);
  const handleSetSearch = useStore(store, (state) => state.handleSetSearch);
  const handleSetSource = useStore(store, (state) => state.handleSetSource);
  const handleCreateOperationClick = useStore(store, (state) => state.handleCreateOperationClick);

  const skillCards = useMemo(() => skills.map(toSkillCardItem), [skills]);
  const visibleSourceFilters = useMemo(() => {
    const availableSources = new Set(skillCards.map((skill) => skill.source));

    return SKILL_SOURCE_FILTERS.filter(
      (item) =>
        item === "All" ||
        item === "Claude Code" ||
        item === "Codex" ||
        item === "Hermes" ||
        availableSources.has(item),
    );
  }, [skillCards]);
  const searchLower = search.toLowerCase();
  const filtered = useMemo(
    () =>
      skillCards.filter((skill) => {
        const matchesSearch =
          !searchLower ||
          skill.name.toLowerCase().includes(searchLower) ||
          skill.title.toLowerCase().includes(searchLower) ||
          skill.description.toLowerCase().includes(searchLower) ||
          skill.operation.toLowerCase().includes(searchLower) ||
          skill.tags.some((tag) => tag.toLowerCase().includes(searchLower));

        return matchesSearch && (source === "All" || skill.source === source);
      }),
    [searchLower, skillCards, source],
  );
  const ownedSkillNames = new Set(skills.map((skill) => skill.name));

  const handlePreviewImportClick = async () => {
    setIsPreviewing(true);
    const response = await dataProvider.custom!<SkillImportPreview>({
      url: "skills/previewImport",
      method: "get",
      payload: { rootPath: importPath },
    });
    const preview = response.data;
    setImportCandidates(preview.candidates);
    setSelectedCandidateIds(
      new Set(
        preview.candidates
          .filter((candidate) => !ownedSkillNames.has(candidate.name))
          .map((candidate) => candidate.id),
      ),
    );
    setImportErrors(preview.errors);
    setIsPreviewing(false);
  };

  const handleCandidateToggle = (candidateId: string) => {
    const candidate = importCandidates.find((item) => item.id === candidateId);
    if (candidate && ownedSkillNames.has(candidate.name)) return;
    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);

      return next;
    });
  };

  const handleImportClick = async () => {
    setIsImporting(true);
    const candidates = importCandidates.filter((candidate) =>
      selectedCandidateIds.has(candidate.id),
    );
    await dataProvider.custom!({
      url: "skills/importCandidates",
      method: "post",
      payload: { candidates },
    });
    await skillsQuery.refetch();
    setImportCandidates([]);
    setSelectedCandidateIds(new Set());
    setIsImporting(false);
  };

  const handleCreateSkillClick = async () => {
    await createSkill({
      resource: ResourceName.skills,
      values: {
        name: createForm.name.trim(),
        label: createForm.label.trim(),
        description: createForm.description.trim(),
        category: "custom",
        tags: ["custom"],
      },
    });
    setCreateForm({ name: "", label: "", description: "" });
    setShowCreateDialog(false);
    await skillsQuery.refetch();
  };

  const handleDeleteSkillClick = async (skillId: string) => {
    await deleteSkill({ resource: ResourceName.skills, id: skillId });
    await skillsQuery.refetch();
  };

  const handleOpenCreateDialogClick = () => setShowCreateDialog(true);
  const handleCreateDialogOpenChange = (open: boolean) => setShowCreateDialog(open);
  const handleCreateDialogCancelClick = () => setShowCreateDialog(false);
  const handleImportPathInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImportPath(event.target.value);
  };

  const handleCreateFieldChange =
    (field: keyof typeof createForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setCreateForm((current) => ({ ...current, [field]: event.target.value }));
    };

  if (skillsQuery.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader
          eyebrow={t("nav.groups.capabilities")}
          icon={<Wand2 className="size-[18px] text-muted-foreground" />}
          sub={t("skills.subtitle")}
          title={t("skills.title")}
        />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleOpenCreateDialogClick}>
            <Plus className="size-4" />
            {t("skills.createSkill")}
          </Button>
        }
        badge={<span className="text-xs text-muted-foreground">{skills.length}</span>}
        eyebrow={t("nav.groups.capabilities")}
        icon={<Wand2 className="size-[18px] text-muted-foreground" />}
        sub={t("skills.subtitle")}
        title={t("skills.title")}
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            placeholder={t("skills.search")}
            value={search}
            onChange={(event) => handleSetSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {visibleSourceFilters.map((item) => (
            <Button
              key={item}
              className="h-7 px-2.5 text-xs"
              size="sm"
              variant={source === item ? "default" : "ghost"}
              onClick={() => handleSetSource(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 min-w-64 flex-1 text-sm sm:max-w-xl"
            placeholder={t("skills.importPath")}
            value={importPath}
            onChange={handleImportPathInputChange}
          />
          <Button
            className="h-8"
            disabled={!importPath.trim() || isPreviewing}
            size="sm"
            variant="outline"
            onClick={handlePreviewImportClick}
          >
            <Download className="size-3.5" />
            {isPreviewing ? t("skills.scanning") : t("skills.previewImport")}
          </Button>
          {importCandidates.length > 0 ? (
            <Button
              className="h-8"
              disabled={selectedCandidateIds.size === 0 || isImporting}
              size="sm"
              onClick={handleImportClick}
            >
              {isImporting
                ? t("skills.importing")
                : t("skills.importSelected", { count: selectedCandidateIds.size })}
            </Button>
          ) : null}
        </div>
        {importErrors.length > 0 ? (
          <div className="mt-2 space-y-1">
            {importErrors.map((error) => (
              <p key={error} className="text-xs text-destructive">
                {error}
              </p>
            ))}
          </div>
        ) : null}
        {importCandidates.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {importCandidates.map((candidate) => {
              const isOwned = ownedSkillNames.has(candidate.name);
              const isSelected = selectedCandidateIds.has(candidate.id);

              return (
                <button
                  key={candidate.id}
                  className={cn(
                    "rounded-lg border bg-background p-3 text-left text-sm transition-colors",
                    isOwned
                      ? "cursor-not-allowed border-border opacity-50"
                      : isSelected
                        ? "border-primary"
                        : "border-border hover:border-primary/50",
                  )}
                  disabled={isOwned}
                  type="button"
                  onClick={() => handleCandidateToggle(candidate.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{candidate.label}</span>
                    <Badge variant={isOwned ? "outline" : isSelected ? "default" : "secondary"}>
                      {isOwned
                        ? t("skills.owned")
                        : isSelected
                          ? t("skills.selected")
                          : t("skills.skipped")}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {candidate.description.split("\n")[0]}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Wand2 className="size-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm">{t("skills.noSkills")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.id}
                item={skill}
                onCreateOperation={handleCreateOperationClick}
                onDelete={handleDeleteSkillClick}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("skills.createSkill")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block text-xs font-medium">
              {t("common.name")}
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="skill-name"
                value={createForm.name}
                onChange={handleCreateFieldChange("name")}
              />
            </label>
            <label className="block text-xs font-medium">
              {t("skills.label")}
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Skill Label"
                value={createForm.label}
                onChange={handleCreateFieldChange("label")}
              />
            </label>
            <label className="block text-xs font-medium">
              {t("common.description")}
              <Input
                className="mt-1 h-8 text-sm"
                placeholder={t("skills.descriptionPlaceholder")}
                value={createForm.description}
                onChange={handleCreateFieldChange("description")}
              />
            </label>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={handleCreateDialogCancelClick}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={!createForm.name.trim() || !createForm.label.trim()}
              size="sm"
              onClick={handleCreateSkillClick}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
