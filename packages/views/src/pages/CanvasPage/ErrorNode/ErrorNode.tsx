import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NodeCard } from "../NodeCard";

export interface ErrorNodeProps {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  selected?: boolean;
}

export const ErrorNode = ({ id, type, selected }: ErrorNodeProps) => {
  const { t } = useTranslation();
  const detail = `type: ${type ?? "undefined"} | id: ${id}`;

  return (
    <NodeCard
      detail={detail}
      icon={AlertTriangle}
      label={t("canvas.unknownNode")}
      leftHandle
      rightHandle
      runStatus="failed"
      selected={selected}
      theme="indigo"
    />
  );
};
