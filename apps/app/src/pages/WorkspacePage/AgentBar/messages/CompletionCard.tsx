import type { ReactNode } from "react";

export type CompletionCardProps = {
  children: ReactNode;
  subtitle: string;
  title: string;
};

/** Minimal completion line — `Done in 41.3s · $0.31 — summary…`. */
export const CompletionCard = ({ children, subtitle, title }: CompletionCardProps) => (
  <div className="text-[12px] leading-relaxed text-foreground/90" data-testid="agent-completion">
    <span className="font-medium">{title}</span>
    <span className="text-muted-foreground"> · {subtitle}</span>
    {" — "}
    {children}
  </div>
);
