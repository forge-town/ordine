import { useOne } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { RefinementRound, RefinementRoundStatus } from "@repo/schemas";
import { Badge } from "@repo/ui/badge";
import { Card } from "@repo/ui/card";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

type RefinementRecord = {
  id: string;
  sourceDistillationId: string;
  maxRounds: number;
  currentRound: number;
  status: string;
  rounds: RefinementRound[];
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
};

const statusIcon = (status: RefinementRoundStatus) =>
  STATUS_ICONS[status] ?? <Loader2 className="h-4 w-4 animate-spin text-primary" />;

const STATUS_VARIANTS: Record<string, "default" | "destructive" | "secondary"> = {
  completed: "default",
  failed: "destructive",
};

const statusVariant = (status: RefinementRoundStatus) =>
  STATUS_VARIANTS[status] ?? ("secondary" as const);

const POLL_INTERVAL = 3000;

export const RefinementPanel = ({ refinementId }: { refinementId: string }) => {
  const { t } = useTranslation();

  const { result: refinement } = useOne<RefinementRecord>({
    resource: ResourceName.refinements,
    id: refinementId,
    queryOptions: {
      refetchInterval: (query) => {
        const status = (query.state.data?.data as RefinementRecord | undefined)?.status;
        if (status === "completed" || status === "failed") return false;

        return POLL_INTERVAL;
      },
    },
  });

  if (!refinement) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {t("distillations.refinementTitle")}
        </h2>
        <Badge variant={refinement.status === "completed" ? "default" : "secondary"}>
          {refinement.status}
        </Badge>
      </div>

      <div className="mt-4 space-y-3">
        {refinement.rounds.map((round) => (
          <div key={round.round} className="flex items-start gap-3 rounded-md border p-3">
            <div className="mt-0.5">{statusIcon(round.status)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {t("distillations.refinementRoundLabel", { round: round.round })}
                </span>
                <Badge className="text-xs" variant={statusVariant(round.status)}>
                  {t(
                    `distillations.refinementStatus${round.status.charAt(0).toUpperCase()}${round.status.slice(1)}` as never
                  )}
                </Badge>
              </div>
              {round.summary && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{round.summary}</p>
              )}
              {round.error && (
                <p className="mt-1 text-xs text-destructive line-clamp-2">{round.error}</p>
              )}
              <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                {round.pipelineId && <span>Pipeline: {round.pipelineId}</span>}
                {round.jobId && <span>Job: {round.jobId.slice(0, 8)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
