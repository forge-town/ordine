import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../canvas.css";
import { CanvasInner } from "../CanvasInner";

export const CanvasPageContent = ({
  onGeneratedPipeline: handleGeneratedPipeline,
  showCanvasMiniSidebar = true,
}: {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
  showCanvasMiniSidebar?: boolean;
}) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <CanvasInner
          showCanvasMiniSidebar={showCanvasMiniSidebar}
          onGeneratedPipeline={handleGeneratedPipeline}
        />
      </ReactFlowProvider>
    </div>
  );
};
