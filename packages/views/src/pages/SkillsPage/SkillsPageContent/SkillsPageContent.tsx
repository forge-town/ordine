import { useMemo, useState, type ChangeEvent, type MouseEvent } from "react";
import { useStore } from "zustand";
import { Download, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Badge } from "@repo/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/dialog";
import { cn } from "@repo/ui/lib/utils";
import type { Skill } from "@repo/schemas";
import { useCreate, useDataProvider, useDelete, useList } from "@refinedev/core";
import { ResourceName } from "../../../constants";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { PageHeader } from "../../../components/PageHeader";
import { useSkillsPageStore, type SkillCategory } from "../_store";

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

const categoryColors: Record<string, string> = {
  page: "bg-violet-100 text-violet-700",
  data: "bg-blue-100 text-blue-700",
  state: "bg-emerald-100 text-emerald-700",
  form: "bg-amber-100 text-amber-700",
  "code-quality": "bg-gray-100 text-gray-600",
};

export const SkillsPageContent = () => {
  const { result: skillsResult, query: skillsQuery } = useList<Skill>({
    resource: ResourceName.skills,
  });
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();
  const skills = skillsResult.data;
  const { t } = useTranslation();
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

  const categoryLabels: Record<SkillCategory, string> = {
    all: t("skills.categories.all"),
    page: t("skills.categories.page"),
    data: t("skills.categories.data"),
    state: t("skills.categories.state"),
    form: t("skills.categories.form"),
    "code-quality": t("skills.categories.code-quality"),
  };

  const store = useSkillsPageStore();
  const search = useStore(store, (s) => s.search);
  const category = useStore(store, (s) => s.category);
  const handleSetSearch = useStore(store, (s) => s.handleSetSearch);
  const handleSetCategory = useStore(store, (s) => s.handleSetCategory);

  const searchLower = search.toLowerCase();
  const filtered = useMemo(() => {
    if (!skills) return [];

    return skills.filter((s: Skill) => {
      const matchesSearch =
        !searchLower ||
        s.label.toLowerCase().includes(searchLower) ||
        s.name.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower);
      const matchesCategory = category === "all" || s.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [skills, searchLower, category]);

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

  const handleDeleteSkillClick = async (event: MouseEvent<HTMLButtonElement>) => {
    const skillId = event.currentTarget.dataset.skillId;
    if (!skillId) return;

    await deleteSkill({ resource: ResourceName.skills, id: skillId });
    await skillsQuery?.refetch?.();
  };

  if (skillsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("skills.title")} />
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
        icon={<Wand2 className="h-4 w-4 text-primary" />}
        title={t("skills.title")}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder={t("common.search")}
            type="text"
            value={search}
            onChange={(event) => handleSetSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
            <Button
              key={cat}
              className="text-xs h-7 px-2.5"
              size="sm"
              variant={category === cat ? "default" : "ghost"}
              onClick={() => handleSetCategory(cat)}
            >
              {categoryLabels[cat]}
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
                      categoryColors[skill.category] ?? "bg-gray-100 text-gray-600",
                    )}
                    variant="secondary"
                  >
                    {categoryLabels[skill.category as SkillCategory] ?? skill.category}
                  </Badge>
                </div>

                <h3 className="mt-3 text-sm font-semibold text-foreground">{skill.label}</h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {skill.description.split("\n")[0]}
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
                  <code className="text-[10px] text-muted-foreground">{skill.name}</code>
                  <Button
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-skill-id={skill.id}
                    size="sm"
                    variant="ghost"
                    onClick={handleDeleteSkillClick}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
