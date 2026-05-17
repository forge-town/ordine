import { SnapshotRow } from "./SnapshotRow";

interface StructuredViewProps {
  data: Record<string, unknown>;
}

export const StructuredView = ({ data }: StructuredViewProps) => (
  <div>
    {Object.entries(data).map(([key, value]) => (
      <SnapshotRow key={key} label={key} value={value} />
    ))}
  </div>
);
