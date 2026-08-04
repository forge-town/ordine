import { useTranslation } from "react-i18next";

export const GNodeMetaLine = ({ children }: { children: React.ReactNode }) => (
  <NodeFieldText className="truncate text-[10px] text-muted-foreground/85">
    {children}
  </NodeFieldText>
);

export const GNodeCodeLine = ({ children }: { children: React.ReactNode }) => (
  <NodeFieldText className="truncate rounded-md bg-surface-2 px-1.5 py-1 font-mono text-[9.5px] text-muted-foreground">
    {children}
  </NodeFieldText>
);

const NodeFieldText = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) => {
  const { i18n } = useTranslation();

  return (
    <div className={className} lang={i18n.language}>
      {children}
    </div>
  );
};
