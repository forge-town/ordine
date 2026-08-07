import { useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useDataProvider } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { ResultAsync } from "neverthrow";
import { Cpu, LoaderCircle, Search, Sparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Textarea } from "@repo/ui/textarea";
import type { Operation } from "@repo/schemas";

type Recommendation = {
  operationId: string;
  operationName: string;
  reason: string;
};

type AnalyzeIntentResult = {
  matchedOperations: Recommendation[];
  unmatchedSteps: Array<{ step: string; reason: string }>;
};

export type FindForMeModalProps = {
  open: boolean;
  operations: Operation[];
  onOpenChange: (open: boolean) => void;
};

export const FindForMeModal = ({ open, operations, onOpenChange }: FindForMeModalProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const getDataProvider = useDataProvider();
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const handleQueryChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(event.target.value);
    setSearchError(false);
  };
  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = query.trim();
    if (!description) return;

    setIsSearching(true);
    setSearchError(false);
    const dataProvider = getDataProvider();
    const result = await ResultAsync.fromPromise(
      dataProvider.custom!<AnalyzeIntentResult>({
        url: "pipelines/analyzeIntent",
        method: "post",
        payload: {
          name: t("components.findForMe.requestName"),
          description,
        },
      }),
      () => "recommendation-failed" as const,
    );
    setIsSearching(false);
    if (result.isErr()) {
      setSearchError(true);
      setRecommendations(null);

      return;
    }
    const operationIds = new Set(operations.map((operation) => operation.id));
    setRecommendations(
      result.value.data.matchedOperations.filter((recommendation) =>
        operationIds.has(recommendation.operationId),
      ),
    );
  };
  const handleRecommendationClick = (operationId: string) => {
    onOpenChange(false);
    void navigate({
      params: { operationId },
      to: "/pipelines/operations/$operationId",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Sparkles className="h-4 w-4 text-foreground/75" />
          </div>
          <DialogTitle>{t("components.findForMe.title")}</DialogTitle>
          <DialogDescription>{t("components.findForMe.subtitle")}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSearch}>
          <Textarea
            aria-label={t("components.findForMe.promptLabel")}
            className="min-h-24 resize-y"
            placeholder={t("components.findForMe.promptPlaceholder")}
            value={query}
            onChange={handleQueryChange}
          />
          <Button className="w-full" disabled={!query.trim() || isSearching} type="submit">
            {isSearching ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isSearching ? t("components.findForMe.searching") : t("components.findForMe.search")}
          </Button>
        </form>

        {searchError && (
          <p
            className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            {t("components.findForMe.error")}
          </p>
        )}

        {recommendations && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-[11px] text-muted-foreground">
              {recommendations.length > 0
                ? t("components.findForMe.intro")
                : t("components.findForMe.empty")}
            </p>
            {recommendations.map((recommendation) => {
              const operation = operations.find(
                (candidate) => candidate.id === recommendation.operationId,
              );

              return (
                <Button
                  key={recommendation.operationId}
                  className="h-auto w-full justify-start gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-accent"
                  type="button"
                  variant="ghost"
                  onClick={() => handleRecommendationClick(recommendation.operationId)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Cpu className="h-3.5 w-3.5 text-foreground/70" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {operation?.name ?? recommendation.operationName}
                    </span>
                    <span className="mt-0.5 block whitespace-normal text-[10.5px] leading-relaxed text-muted-foreground">
                      {recommendation.reason}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
