import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { NodeConfigSectionProps } from "./types";

const getEdgeLabel = (edge: NodeConfigSectionProps["edges"][number]) => edge.data?.label || "data";

export const IOSection = ({ node, edges }: NodeConfigSectionProps) => {
  const incoming = edges.filter((edge) => edge.target === node.id);
  const outgoing = edges.filter((edge) => edge.source === node.id);

  return (
    <section className="space-y-3 rounded-lg bg-background p-3 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[12px] font-semibold">Input / Output</h3>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowDownToLine className="h-3 w-3" />
            Inputs
          </div>
          {incoming.length > 0 ? (
            <div className="space-y-1">
              {incoming.map((edge) => (
                <div
                  key={edge.id}
                  className="rounded-md bg-surface px-2 py-1.5 text-[11.5px] ring-1 ring-border"
                >
                  <div className="truncate font-mono">{getEdgeLabel(edge)}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {edge.source}
                    {" -> "}
                    {node.id}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">No incoming data.</p>
          )}
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <ArrowUpFromLine className="h-3 w-3" />
            Outputs
          </div>
          {outgoing.length > 0 ? (
            <div className="space-y-1">
              {outgoing.map((edge) => (
                <div
                  key={edge.id}
                  className="rounded-md bg-surface px-2 py-1.5 text-[11.5px] ring-1 ring-border"
                >
                  <div className="truncate font-mono">{getEdgeLabel(edge)}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {node.id}
                    {" -> "}
                    {edge.target}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">No outgoing data.</p>
          )}
        </div>
      </div>
    </section>
  );
};
