import { PipelineDetailPageContent } from "./PipelineDetailPageContent";

interface PipelineDetailPageProps {
  pipelineId: string;
}

export const PipelineDetailPage = ({ pipelineId }: PipelineDetailPageProps) => {
  return <PipelineDetailPageContent pipelineId={pipelineId} />;
};
