import { RunRequestReceiptSchema } from "@repo/schemas";
import { ExecutionRequestCard } from "../ExecutionRequest/ExecutionRequestCard";
import { useAgentControl } from "./GlobalAgentControlProvider";

export const AgentExecutionRequests = () => {
  const actions = useAgentControl((state) => state.actions);
  const requestIds = [
    ...new Set(
      actions.flatMap((action) => {
        if (action.status !== "succeeded" && action.status !== "replayed") return [];
        const data = action.result?.data;
        const receipt = RunRequestReceiptSchema.safeParse(
          data && typeof data === "object" && "executionReceipt" in data
            ? data.executionReceipt
            : null,
        );

        return receipt.success ? [receipt.data.requestId] : [];
      }),
    ),
  ];

  return (
    <>
      {requestIds.map((requestId) => (
        <ExecutionRequestCard key={requestId} requestId={requestId} />
      ))}
    </>
  );
};
