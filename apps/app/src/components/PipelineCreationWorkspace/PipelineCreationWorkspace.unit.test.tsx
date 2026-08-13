import { StrictMode, type PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/test-wrapper";
import { pipelineAgentSessionsClient } from "@/lib/pipelineAgentSessionsClient";
import { router } from "@/router";
import { PipelineCreationWorkspace } from "./PipelineCreationWorkspace";

const { mockCreatePipeline, mockCustomRequest } = vi.hoisted(() => ({
  mockCreatePipeline: vi.fn(),
  mockCustomRequest: vi.fn(),
}));

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

vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: { pipelines: "pipelines" },
  dataProvider: {
    create: (...args: unknown[]) => mockCreatePipeline(...args),
    custom: (...args: unknown[]) => mockCustomRequest(...args),
  },
}));

const createClient = () => ({
  ...pipelineAgentSessionsClient,
  appendMessage: vi.fn(),
  approveProposal: vi.fn().mockResolvedValue(undefined),
  cancelSession: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn(),
  generatePipelineFromApprovedProposal: vi.fn().mockResolvedValue({ pipelineId: "pipeline-1" }),
  getLatestAssistantQuestion: vi.fn().mockResolvedValue(null),
  getLatestReadyProposal: vi.fn().mockResolvedValue(null),
  getSessionById: vi.fn(),
  planSessionStream: vi.fn(),
});

describe("PipelineCreationWorkspace", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    vi.clearAllMocks();
    mockCreatePipeline.mockImplementation(async ({ variables }) => ({
      data: { ...(variables as object), id: "draft-pipeline-1" },
    }));
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
      <StrictMode>
        <PipelineCreationWorkspace
          active
          client={client as typeof pipelineAgentSessionsClient}
          presentation="home"
        />
      </StrictMode>,
    );

    expect(await screen.findByText("Build a review pipeline")).toBeInTheDocument();
    expect(screen.getByText("requirements.md")).toBeInTheDocument();
    expect(screen.getByText("Review repository code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "newPipelineDialog.approve" })).toBeEnabled();
  });

  it("restores a stale analyzing session as an editable conversation", async () => {
    globalThis.localStorage.setItem("ordine.pipeline-agent.current-session-id", "stale-session");
    const client = createClient();
    client.getSessionById.mockResolvedValue({
      id: "stale-session",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "awaiting_user",
      latestProposalId: null,
      createdPipelineId: null,
      messages: [
        {
          id: "stale-message",
          role: "user",
          kind: "text",
          content: "Build a review pipeline",
        },
      ],
      attachments: [],
      proposals: [],
    });

    render(
      <PipelineCreationWorkspace
        active
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );

    expect(await screen.findByText("Build a review pipeline")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "newPipelineDialog.messagePlaceholder" }),
    ).toBeEnabled();
    expect(screen.queryByText("newPipelineDialog.restoring")).not.toBeInTheDocument();
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
        runtimeConfigured
        client={client as typeof pipelineAgentSessionsClient}
        presentation="dialog"
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

  it("keeps the selected local runtime through planning and generation", async () => {
    const user = userEvent.setup();
    const client = createClient();
    const materializePipeline = vi.fn().mockResolvedValue("pipeline-1");
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
      content: "Build an exam pipeline",
    });
    client.planSessionStream.mockImplementation(async (_sessionId, input) => {
      input.onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Generate an English exam",
          inputs: ["exam requirements"],
          outputs: ["exam paper"],
          majorOperations: ["draft questions"],
          executionFlow: ["requirements -> questions -> exam"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });

    render(
      <PipelineCreationWorkspace
        active
        runtimeConfigured
        client={client as typeof pipelineAgentSessionsClient}
        materializePipeline={materializePipeline}
        presentation="dialog"
        runtimeId="local-codex"
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: "newPipelineDialog.messagePlaceholder" }),
      "Build an exam pipeline",
    );
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.send" }));

    expect(await screen.findByText("Generate an English exam")).toBeInTheDocument();
    expect(client.planSessionStream).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ runtimeId: "local-codex" }),
    );
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.approve" }));

    await waitFor(() =>
      expect(client.generatePipelineFromApprovedProposal).toHaveBeenCalledWith("session-1", {
        runtimeId: "local-codex",
        signal: expect.any(AbortSignal),
      }),
    );
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

  it("starts fresh instead of restoring a terminal failed session", async () => {
    globalThis.localStorage.setItem("ordine.pipeline-agent.current-session-id", "failed-session");
    const client = createClient();
    client.getSessionById.mockResolvedValue({
      id: "failed-session",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "failed",
      latestProposalId: null,
      createdPipelineId: null,
      messages: [
        {
          id: "message-failed",
          role: "user",
          kind: "text",
          content: "This message should not remain on the home page",
        },
      ],
      attachments: [],
      proposals: [],
    });

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
    expect(
      screen.queryByText("This message should not remain on the home page"),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("textbox", { name: "newPipelineDialog.messagePlaceholder" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("newPipelineDialog.restoring")).not.toBeInTheDocument();
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

    expect(await screen.findByText("pipelineAgentErrors.network")).toBeInTheDocument();
  });

  it("creates a draft and transfers the first message and runtime to its canvas", async () => {
    const user = userEvent.setup();
    const client = createClient();

    render(
      <PipelineCreationWorkspace
        active
        runtimeConfigured
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
        runtimeId="runtime-codex"
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: "newPipelineDialog.messagePlaceholder" }),
      "Scout hackathons for me",
    );
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.send" }));

    expect(mockCreatePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "pipelines",
        variables: expect.objectContaining({
          description: "Scout hackathons for me",
          nodes: [],
          edges: [],
        }),
      }),
    );
    expect(JSON.parse(globalThis.sessionStorage.getItem("ordine.pendingPipelinePrompt")!)).toEqual({
      prompt: "Scout hackathons for me",
      runtimeId: "runtime-codex",
    });
    expect(router.navigate).toHaveBeenCalledWith({
      to: "/canvas",
      search: { id: "draft-pipeline-1" },
    });
    expect(client.createSession).not.toHaveBeenCalled();
    expect(client.appendMessage).not.toHaveBeenCalled();
  });

  it("keeps the in-page flow when a home session already exists", async () => {
    globalThis.localStorage.setItem("ordine.pipeline-agent.current-session-id", "session-live");
    const user = userEvent.setup();
    const client = createClient();
    client.getSessionById.mockResolvedValue({
      id: "session-live",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "awaiting_user",
      latestProposalId: null,
      createdPipelineId: null,
      messages: [
        {
          id: "message-1",
          role: "user",
          kind: "text",
          content: "Build a pipeline",
        },
      ],
      attachments: [],
      proposals: [],
    });
    client.appendMessage.mockResolvedValue({
      id: "message-2",
      role: "user",
      kind: "text",
      content: "More details",
    });
    client.planSessionStream.mockImplementation(async (_sessionId, input) => {
      input.onEvent({ type: "question", question: "What inputs?" });
    });

    render(
      <PipelineCreationWorkspace
        active
        runtimeConfigured
        client={client as typeof pipelineAgentSessionsClient}
        presentation="home"
      />,
    );
    await screen.findByText("Build a pipeline");
    await user.type(
      screen.getByRole("textbox", { name: "newPipelineDialog.messagePlaceholder" }),
      "More details",
    );
    await user.click(screen.getByRole("button", { name: "newPipelineDialog.send" }));

    expect(await screen.findByText("What inputs?")).toBeInTheDocument();
    expect(client.appendMessage).toHaveBeenCalledWith(
      "session-live",
      expect.objectContaining({ content: "More details" }),
      expect.anything(),
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.getItem("ordine.pendingPipelinePrompt")).toBeNull();
  });
});
