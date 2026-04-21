import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CanvasInner } from "../CanvasInner";

export const CanvasPageContent = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
};
