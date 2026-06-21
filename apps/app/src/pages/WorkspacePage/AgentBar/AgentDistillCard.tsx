import { useList } from "@refinedev/core";
import { useNavigate } from "@tanstack/react-router";
import type { PipelineAsset } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { DistillCard } from "./messages";

export type AgentDistillCardProps = {
  pipelineId: string;
};

export const AgentDistillCard = ({ pipelineId }: AgentDistillCardProps) => {
  const navigate = useNavigate();
  const { result: assetsResult } = useList<PipelineAsset>({
    filters: [{ field: "pipelineId", operator: "eq", value: pipelineId }],
    queryOptions: { enabled: !!pipelineId },
    resource: ResourceName.pipelineAssets,
  });
  const asset = assetsResult.data?.[0];
  const handleOpenClick = () => {
    void navigate({ to: "/components" });
  };

  if (!asset) return null;

  return (
    <DistillCard
      subtitle={`${asset.name} - saved to Components`}
      title="Distilled to Components"
      onOpen={handleOpenClick}
    />
  );
};
