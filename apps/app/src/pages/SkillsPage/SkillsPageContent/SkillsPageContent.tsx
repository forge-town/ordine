import { useTranslation } from "react-i18next";
import { useMemo, useState, type ChangeEvent } from "react";
import { useStore } from "zustand";
import { Download, Plus, Search, Wand2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import type { Skill } from "@repo/schemas";
import { useCreate, useDataProvider, useDelete, useList } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { PageLoadingState } from "@/components/PageLoadingState";
import { PageHeader } from "@/components/PageHeader";
import { Icon } from "@/components/primitives";
import { SKILL_SOURCE_FILTERS, useSkillsPageStore, type SkillSourceFilter } from "../_store";
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
  data: "schema -> dao/service",
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

const includesAny = (values: string[], needles: string[]) => {
  return values.some((value) => needles.some((needle) => value.includes(needle)));
};

const getSkillTokens = (skill: Skill) => {
  return [skill.name, skill.label, skill.category, ...skill.tags].map(normalizeToken);
};

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

const getOperationName = (skill: Skill) => {
  const title = skill.label.trim() || skill.name;

  return `${title} Operation`;
};

const toSkillCardItem = (skill: Skill): SkillCardItem => {
  const source = getSkillSource(skill);

  return {
    id: skill.id,
    description: skill.description.split("\n")[0] || "No description yet.",
    io: IO_BY_CATEGORY[skill.category] ?? "input -> output",
    name: skill.name,
    operation: getOperationName(skill),
    source,
    sourceCaption: getSourceCaption(source),
    sourceTone: SOURCE_TONES[source] ?? "neutral",
    tags: skill.tags,
    title: skill.label,
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
  const search = useStore(store, (s) => s.search);
  const source = useStore(store, (s) => s.source);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetSource = useStore(store, (s) => s.handleSetSource);
  const handleCreateOperationClick = useStore(store, (s) => s.handleCreateOperationClick);

  const searchLower = search.toLowerCase();
  const skillCards = useMemo(() => {
    return skills.map(toSkillCardItem);
  }, [skills]);

  const visibleSourceFilters = useMemo(() => {
    const availableSources = new Set(skillCards.map((skill) => skill.source));

    return SKILL_SOURCE_FILTERS.filter((filter) => {
      if (filter === "All") return true;
      if (filter === "Claude Code" || filter === "Codex" || filter === "Hermes") return true;

      return availableSources.has(filter);
    });
  }, [skillCards]);

  const filtered = useMemo(() => {
    return skillCards.filter((s) => {
      const matchesSearch =
        !searchLower ||
        s.name.toLowerCase().includes(searchLower) ||
        s.title.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower) ||
        s.operation.toLowerCase().includes(searchLower) ||
        s.tags.some((tag) => tag.toLowerCase().includes(searchLower));
      const matchesSource = source === "All" || s.source === source;

      return matchesSearch && matchesSource;
    });
  }, [skillCards, searchLower, source]);

  const handleImportPathInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setImportPath(event.target.value);
  };

  const handlePreviewImportClick = async () => {
    setIsPreviewing(true);
    const response = await dataProvider.custom!<SkillImportPreview>({
      url: "skills/previewImport",
      method: "get",
      payload: { rootPath: importPath },
    });
    const preview = response.data;
    const ownedNames = new Set((skills ?? []).map((s) => s.name));
    setImportCandidates(preview.candidates);
    setSelectedCandidateIds(
      new Set(preview.candidates.filter((c) => !ownedNames.has(c.name)).map((c) => c.id)),
    );
    setImportErrors(preview.errors);
    setIsPreviewing(false);
  };

  const ownedSkillNames = new Set((skills ?? []).map((s) => s.name));

  const handleCandidateToggle = (candidateId: string) => {
    const candidate = importCandidates.find((c) => c.id === candidateId);
    if (candidate && ownedSkillNames.has(candidate.name)) return;

    setSelectedCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }

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
    await skillsQuery?.refetch?.();
    setImportCandidates([]);
    setSelectedCandidateIds(new Set());
    setIsImporting(false);
  };

  const handleOpenCreateDialogClick = () => {
    setShowCreateDialog(true);
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setShowCreateDialog(open);
  };

  const handleCreateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateForm((form) => ({ ...form, name: event.target.value }));
  };

  const handleCreateLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateForm((form) => ({ ...form, label: event.target.value }));
  };

  const handleCreateDescriptionChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCreateForm((form) => ({ ...form, description: event.target.value }));
  };

  const handleCreateDialogCancelClick = () => {
    setShowCreateDialog(false);
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
    await skillsQuery?.refetch?.();
  };

  const handleDeleteSkillClick = async (skillId: string) => {
    await deleteSkill({ resource: ResourceName.skills, id: skillId });
    await skillsQuery?.refetch?.();
  };

  if (skillsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("nav.items.skills")} />
        <PageLoadingState variant="grid" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button size="sm" onClick={handleOpenCreateDialogClick}>
            <Plus className="h-4 w-4" />
            Create Skill
          </Button>
        }
        badge={<span className="text-xs text-muted-foreground">{skills.length}</span>}
        icon={<Icon className="text-muted-foreground" icon={Wand2} size={18} />}
        title="Skills"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search skills..."
            type="text"
            value={search}
            onChange={(event) => handleSetSearch(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {visibleSourceFilters.map((filter) => (
            <Button
              key={filter}
              className="text-xs h-7 px-2.5"
              size="sm"
              variant={source === filter ? "default" : "ghost"}
              onClick={() => handleSetSource(filter)}
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      <div className="border-b border-border bg-muted/20 px-6 py-3">
        <div className="flex items-center gap-2">
          <Input
            className="h-8 max-w-xl text-sm"
            placeholder="Path to a Codex / Claude Code skills folder"
            type="text"
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
            <Download className="h-3.5 w-3.5" />
            {isPreviewing ? "Scanning..." : "Preview Import"}
          </Button>
          {importCandidates.length > 0 && (
            <Button
              className="h-8"
              disabled={selectedCandidateIds.size === 0 || isImporting}
              size="sm"
              onClick={handleImportClick}
            >
              {isImporting ? "Importing..." : `Import ${selectedCandidateIds.size}`}
            </Button>
          )}
        </div>
        {importErrors.length > 0 && (
          <div className="mt-2 space-y-1">
            {importErrors.map((error) => (
              <p key={error} className="text-xs text-destructive">
                {error}
              </p>
            ))}
          </div>
        )}
        {importCandidates.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {importCandidates.map((candidate) => {
              const isOwned = ownedSkillNames.has(candidate.name);
              const isSelected = selectedCandidateIds.has(candidate.id);

              return (
                <button
                  key={candidate.id}
                  className={cn(
                    "rounded-lg border bg-background p-3 text-left text-sm transition-colors",
                    isOwned
                      ? "border-border opacity-50 cursor-not-allowed"
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
                      {isOwned ? "Owned" : isSelected ? "Selected" : "Skipped"}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {candidate.description.split("\n")[0]}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="skill-name"
                value={createForm.name}
                onChange={handleCreateNameChange}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Label</label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Skill Label"
                value={createForm.label}
                onChange={handleCreateLabelChange}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="What this skill does"
                value={createForm.description}
                onChange={handleCreateDescriptionChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={handleCreateDialogCancelClick}>
              Cancel
            </Button>
            <Button
              disabled={!createForm.name.trim() || !createForm.label.trim()}
              size="sm"
              onClick={handleCreateSkillClick}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
            <Wand2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm">No skills found</p>
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
    </div>
  );
};
