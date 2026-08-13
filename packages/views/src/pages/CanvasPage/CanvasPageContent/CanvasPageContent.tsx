import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../canvas.css";
import { CanvasInner } from "../CanvasInner";

export const CanvasPageContent = ({
  onGeneratedPipeline,
}: {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
}) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <CanvasInner onGeneratedPipeline={onGeneratedPipeline} />
      </ReactFlowProvider>
    </div>
  );
};
