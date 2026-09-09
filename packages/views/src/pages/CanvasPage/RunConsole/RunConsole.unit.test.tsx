import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunRequestInputSchema } from "@repo/schemas";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import {
  beginSubmission,
  idleSubmission,
  uncertainSubmission,
} from "../../../execution/submission";
import { RunConsole } from "./RunConsole";
import "../../../test/use-test-language";

vi.mock("../../../components/ExecutionRequest/ExecutionRequestCard", () => ({
  ExecutionRequestCard: ({ requestId }: { requestId: string }) => (
    <div data-testid="v2-request">{requestId}</div>
  ),
}));
const mount = (visible = true, submitting = false) => {
  const store = createCanvasPageStore([], []);
  const request = RunRequestInputSchema.parse({
    apiVersion: 2,
    requestId: crypto.randomUUID(),
    pipelineId: "published",
    expectedRevision: 1,
  });
  store.setState({
    isConsoleOpen: true,
    executionSubmission: submitting
      ? beginSubmission(idleSubmission(), request)
      : uncertainSubmission(beginSubmission(idleSubmission(), request), "查询原请求"),
  });
  render(
    <CanvasPageStoreContext.Provider value={store}>
      <RunConsole visible={visible} />
    </CanvasPageStoreContext.Provider>,
  );

  return { store, request };
};
describe("Canvas v2 RunConsole", () => {
  it("does not read a receipt before the submission has completed", () => {
    mount(true, true);
    expect(screen.queryByTestId("v2-request")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在提交运行请求");
  });
  it("keeps the original console shell and renders the exact v2 request", () => {
    const { request } = mount();
    expect(screen.getByTestId("canvas-run-console")).toHaveClass("absolute", "bottom-16");
    expect(screen.getByTestId("v2-request")).toHaveTextContent(request.requestId);
  });
  it("keeps request recovery mounted when the console closes", () => {
    mount(false);
    expect(screen.getByTestId("canvas-run-console")).not.toBeVisible();
    expect(screen.getByTestId("v2-request")).toBeInTheDocument();
  });
  it("collapses and closes without clearing or cancelling the execution", () => {
    const { store, request } = mount();
    fireEvent.click(screen.getByTestId("run-console-toggle"));
    expect(store.getState().isConsoleCollapsed).toBe(true);
    fireEvent.click(screen.getByTestId("run-console-close"));
    expect(store.getState().isConsoleOpen).toBe(false);
    expect(store.getState().executionSubmission.request?.requestId).toBe(request.requestId);
  });
});
