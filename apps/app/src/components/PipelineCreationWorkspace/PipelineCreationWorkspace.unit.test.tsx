import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/test-wrapper";
import { pipelineAgentSessionsClient } from "@/lib/pipelineAgentSessionsClient";
import { PipelineCreationWorkspace } from "./PipelineCreationWorkspace";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/router", () => ({
  router: { navigate: vi.fn() },
}));

const createClient = () => ({
  ...pipelineAgentSessionsClient,
  appendMessage: vi.fn(),
  cancelSession: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn(),
  getSessionById: vi.fn(),
  planSessionStream: vi.fn(),
});

describe("PipelineCreationWorkspace", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    vi.clearAllMocks();
  });

  it("restores messages, attachments, and a pending proposal from the saved session", async () => {
    globalThis.localStorage.setItem("ordine.pipeline-agent.current-session-id", "session-restore");
    const client = createClient();
    client.getSessionById.mockResolvedValue({
      id: "session-restore",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "proposal_ready",
      latestProposalId: "proposal-1",
      createdPipelineId: null,
      messages: [
        {
          id: "message-1",
          role: "user",
          kind: "text",
          content: "Build a review pipeline",
        },
      ],
      attachments: [
        {
          id: "attachment-1",
          filename: "requirements.md",
          parseStatus: "parsed",
          parseError: null,
        },
      ],
      proposals: [
        {
          id: "proposal-1",
          mode: "generate",
          status: "proposal_ready",
          proposal: {
            mode: "generate",
            purpose: "Review repository code",
            inputs: ["folder"],
            outputs: ["report"],
            majorOperations: ["review-code"],
            executionFlow: ["folder -> review-code -> report"],
            assumptions: [],
            openQuestions: [],
            readiness: "ready_for_generation",
          },
        },
      ],
    });

    render(
      <PipelineCreationWorkspace
        active
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );

    expect(await screen.findByText("Build a review pipeline")).toBeInTheDocument();
    expect(screen.getByText("requirements.md")).toBeInTheDocument();
    expect(screen.getByText("Review repository code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "newPipelineDialog.approve" })).toBeEnabled();
  });

  it("cancels planning and returns the composer to an editable state", async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.createSession.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
    });
    client.appendMessage.mockResolvedValue({
      id: "message-1",
      role: "user",
      kind: "text",
      content: "Build a pipeline",
    });
    client.planSessionStream.mockImplementation(
      (_sessionId, input: { signal?: AbortSignal }) =>
        new Promise<void>((_resolvePromise, rejectPromise) => {
          input.signal?.addEventListener(
            "abort",
            () => rejectPromise(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );

    render(
      <PipelineCreationWorkspace
        active
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );
    const composer = screen.getByRole("textbox", {
      name: "newPipelineDialog.messagePlaceholder",
    });
    await user.type(composer, "Build a pipeline");
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.send" }));
    await user.click(await screen.findByRole("button", { name: "newPipelineDialog.cancel" }));

    await waitFor(() => expect(client.cancelSession).toHaveBeenCalledWith("session-1"));
    expect(
      screen.queryByRole("button", { name: "newPipelineDialog.cancel" }),
    ).not.toBeInTheDocument();
    expect(composer).toBeEnabled();
  });

  it("clears a saved session id when the server no longer has the session", async () => {
    globalThis.localStorage.setItem("ordine.pipeline-agent.current-session-id", "missing-session");
    const client = createClient();
    const missingError = Object.assign(new Error("Session not found"), { status: 404 });
    client.getSessionById.mockRejectedValue(missingError);

    render(
      <PipelineCreationWorkspace
        active
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );

    await waitFor(() =>
      expect(
        globalThis.localStorage.getItem("ordine.pipeline-agent.current-session-id"),
      ).toBeNull(),
    );
  });

  it("shows a recoverable error when session creation fails before upload", async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.createSession.mockRejectedValue(new Error("Session service unavailable"));

    render(
      <PipelineCreationWorkspace
        active
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.upload" }));

    expect(await screen.findByText("Session service unavailable")).toBeInTheDocument();
  });
});
