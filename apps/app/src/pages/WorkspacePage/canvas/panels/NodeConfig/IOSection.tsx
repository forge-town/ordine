import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { NodeConfigSectionProps } from "./types";

const getEdgeLabel = (edge: NodeConfigSectionProps["edges"][number]) => edge.data?.label || "data";

export const IOSection = ({ node, edges }: NodeConfigSectionProps) => {
  const { t } = useTranslation();
  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);

  const renderEdges = (items: typeof edges, direction: "in" | "out") =>
    items.length > 0 ? (
      <div className="space-y-1">
        {items.map((edge) => (
          <div
            key={edge.id}
            className="rounded-md bg-surface px-2 py-1.5 text-xs ring-1 ring-border"
          >
            <div className="truncate font-mono">{getEdgeLabel(edge)}</div>
            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
              {direction === "in" ? `${edge.source} → ${node.id}` : `${node.id} → ${edge.target}`}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-xs text-muted-foreground">
        {direction === "in"
          ? t("workspace.canvas.nodeConfig.io.noInputs")
          : t("workspace.canvas.nodeConfig.io.noOutputs")}
      </p>
    );

  return (
    <section className="space-y-3 rounded-xl bg-surface-2/60 p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="size-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold">{t("workspace.canvas.nodeConfig.io.title")}</h3>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowDownToLine className="size-3" />
            {t("workspace.canvas.nodeConfig.io.inputs")}
          </div>
          {renderEdges(incoming, "in")}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowUpFromLine className="size-3" />
            {t("workspace.canvas.nodeConfig.io.outputs")}
          </div>
          {renderEdges(outgoing, "out")}
        </div>
      </div>
    </section>
  );
};
