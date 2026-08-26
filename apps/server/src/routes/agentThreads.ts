import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Hono } from "hono";
import { err, Result, ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import { listAgentControlTools, toMcpToolDefinition } from "@repo/agent-control";
import {
  AgentControlCapabilitiesSchema,
  AgentContextEnvelopeSchema,
  AgentControlScopeSchema,
  type AgentControlScope,
} from "@repo/schemas";
import { agentApiAuthMiddleware } from "../integrations/auth";
import { getEnv } from "../integrations/env";
import {
  agentControlService,
  agentRunCapabilityStore,
  agentRuntimesService,
  agentRunsService,
  agentThreadsService,
} from "../services.js";
import { buildAgentControlPrompt } from "./agentControlPrompt";
import { resultJson, validateJson, validationErrorJson } from "./result";

const CONTROL_SCOPES = AgentControlScopeSchema.options satisfies readonly AgentControlScope[];
const CONTROL_SERVER_KEY = "ordine_control";
const CONTROL_TEMP_PREFIX = "ordine-agent-control-";
const CONTROL_CWD_RETENTION_MS = 10 * 60 * 1000;
const CONTROL_RUNTIME = "codex";
const DEFAULT_CONTROL_MODEL = "gpt-5.6-luna";
const DEFAULT_CONTROL_REASONING_EFFORT = "xhigh";
const controlCwdCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const CLAUDE_CONTROL_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_OAUTH_TOKEN",
] as const;

const loadClaudeControlEnvironment = async (): Promise<Record<string, string>> => {
  const settings = await readFile(join(homedir(), ".claude", "settings.json"), "utf8").then(
    (value) => value,
    () => null,
  );
  if (!settings) return {};
  const decoded = Result.fromThrowable(
    (value: string) => JSON.parse(value) as unknown,
    () => null,
  )(settings);
  if (decoded.isErr()) return {};
  const parsed = z
    .object({ env: z.record(z.string(), z.string()).optional() })
    .passthrough()
    .safeParse(decoded.value);
  if (!parsed.success) return {};

  return Object.fromEntries(
    CLAUDE_CONTROL_ENV_KEYS.flatMap((key) => {
      const value = parsed.data.env?.[key];

      return value ? [[key, value] as const] : [];
    }),
  );
};

const runtimeControlSupport = (runtime: string) => {
  if (runtime === "claude-code") {
    return {
      supported: false,
      reason: "Claude Code control mode has not passed this release's machine acceptance.",
      controlModel: null,
      controlReasoningEffort: null,
    } as const;
  }
  if (runtime === "opencode") {
    return {
      supported: false,
      reason: "OpenCode MCP-only wildcard permission isolation has not passed the machine probe.",
      controlModel: null,
      controlReasoningEffort: null,
    } as const;
  }
  if (runtime === "codex") {
    return {
      supported: true,
      reason:
        "Codex control mode runs in an empty temporary cwd with isolated HOME/config and a run-scoped ORDINE MCP capability. Luna xhigh is the tested default; each run may select another advertised model profile.",
      controlModel: DEFAULT_CONTROL_MODEL,
      controlReasoningEffort: DEFAULT_CONTROL_REASONING_EFFORT,
    } as const;
  }

  return {
    supported: false,
    reason: `${runtime} is not supported by the run-scoped Agent Control runtime.`,
    controlModel: null,
    controlReasoningEffort: null,
  } as const;
};

const CreateThreadSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    context: AgentContextEnvelopeSchema.nullable().optional(),
  })
  .strict();

const UpdateThreadSchema = z
  .object({
    title: z.string().trim().min(1).max(240).optional(),
    context: AgentContextEnvelopeSchema.optional(),
    status: z.literal("archived").optional(),
  })
  .strict();

const AddMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    kind: z
      .enum([
        "text",
        "question",
        "answer",
        "proposal_summary",
        "generation_result",
        "phase",
        "progress",
      ])
      .default("text"),
    content: z.string().min(1).max(100_000),
    context: AgentContextEnvelopeSchema.nullable().optional(),
    runId: z.string().min(1).nullable().optional(),
  })
  .strict();

const StartRunSchema = z
  .object({
    message: z.string().trim().min(1).max(100_000),
    context: AgentContextEnvelopeSchema.optional(),
    runtimeId: z.string().min(1).optional(),
    model: z.string().trim().min(1).max(240).optional(),
    reasoningEffort: z.string().trim().min(1).max(64).optional(),
    speed: z.string().min(1).optional(),
    firstOutputTimeoutSeconds: z.number().int().min(0).max(3600).optional(),
  })
  .strict();

const VersionSchema = z.object({ expectedVersion: z.number().int().positive() }).strict();

const safeRemoveControlCwd = async (cwd: string): Promise<void> => {
  const resolvedCwd = resolve(cwd);
  const resolvedTmp = resolve(tmpdir());
  if (
    dirname(resolvedCwd) !== resolvedTmp ||
    !basename(resolvedCwd).startsWith(CONTROL_TEMP_PREFIX)
  ) {
    throw new Error(`Refusing to remove unexpected Agent Control directory: ${resolvedCwd}`);
  }
  await rm(resolvedCwd, { force: true, recursive: true });
};

const isReusableControlCwd = async (cwd: string): Promise<boolean> => {
  const resolvedCwd = resolve(cwd);
  if (
    dirname(resolvedCwd) !== resolve(tmpdir()) ||
    !basename(resolvedCwd).startsWith(CONTROL_TEMP_PREFIX)
  ) {
    return false;
  }
  const info = await stat(resolvedCwd).then(
    (value) => value,
    () => null,
  );

  return info?.isDirectory() ?? false;
};

const retainControlCwd = (cwd: string) => {
  const existing = controlCwdCleanupTimers.get(cwd);
  if (existing) globalThis.clearTimeout(existing);
  const timer = globalThis.setTimeout(() => {
    controlCwdCleanupTimers.delete(cwd);
    void safeRemoveControlCwd(cwd).then(
      () => undefined,
      () => undefined,
    );
  }, CONTROL_CWD_RETENTION_MS);
  timer.unref?.();
  controlCwdCleanupTimers.set(cwd, timer);
};

const controlMcpToolNames = (runtime: string): string[] =>
  listAgentControlTools({ audience: "internal-run", scopes: new Set(CONTROL_SCOPES) }).map(
    // Claude normalizes MCP tool names to identifier-safe underscores before
    // matching --tools/--allowedTools. Codex `enabled_tools` instead requires
    // the exact name reported by MCP tools/list, including dots.
    (tool) =>
      `mcp__${CONTROL_SERVER_KEY}__${
        runtime === "codex" ? tool.name : tool.name.replaceAll(/[^a-zA-Z0-9_-]/g, "_")
      }`,
  );

const startControlRun = async ({
  threadId,
  message,
  context,
  runtimeId,
  model = DEFAULT_CONTROL_MODEL,
  reasoningEffort = DEFAULT_CONTROL_REASONING_EFFORT,
  speed,
  firstOutputTimeoutSeconds,
  resumeFromRunId: requestedResumeFromRunId,
}: z.infer<typeof StartRunSchema> & {
  threadId: string;
  context: z.infer<typeof AgentContextEnvelopeSchema>;
  resumeFromRunId?: string;
}) => {
  const runtimes = await agentRuntimesService.getAll();
  const selected = runtimeId
    ? runtimes.find((runtime) => runtime.id === runtimeId)
    : runtimes.find((runtime) => runtime.type === CONTROL_RUNTIME);
  if (!selected) {
    return err(
      new Error(
        runtimeId
          ? `Configured Agent runtime not found: ${runtimeId}`
          : "No Codex runtime is configured for Agent Control mode",
      ),
    );
  }
  const support = runtimeControlSupport(selected.type);
  if (!support.supported) {
    return err(new Error(`${selected.type} controlModeUnsupported: ${support.reason}`));
  }
  const previous = requestedResumeFromRunId
    ? await agentRunsService.getById(requestedResumeFromRunId)
    : await agentRunsService.getLatestByOwner("agent-thread", threadId);
  const canResume =
    previous?.status === "completed" &&
    previous.owner.type === "agent-thread" &&
    previous.owner.id === threadId &&
    previous.runtimeConfigId === selected.id &&
    previous.model === model &&
    previous.reasoningEffort === reasoningEffort &&
    (await isReusableControlCwd(previous.cwd));
  if (requestedResumeFromRunId && !canResume) {
    return err(
      new Error(
        `Agent Control cannot resume the requested original run ${requestedResumeFromRunId}; its native session, runtime profile, owner, or isolated cwd is no longer reusable.`,
      ),
    );
  }
  const cwd = canResume ? previous.cwd : await mkdtemp(join(tmpdir(), CONTROL_TEMP_PREFIX));
  const pendingCleanup = controlCwdCleanupTimers.get(cwd);
  if (pendingCleanup) globalThis.clearTimeout(pendingCleanup);
  controlCwdCleanupTimers.delete(cwd);
  const isolatedHome = join(cwd, "home");
  await mkdir(isolatedHome, { recursive: true });
  const prompts = buildAgentControlPrompt({ threadId, message, context });
  const mcpToolNames = controlMcpToolNames(selected.type);
  const runtimeAuthEnvironment =
    selected.type === "claude-code" ? await loadClaudeControlEnvironment() : {};
  const resumeFromRunId = canResume ? previous.id : undefined;
  const env = getEnv();
  const port = env.PORT ?? 9433;
  const started = await ResultAsync.fromPromise(
    agentRunsService.start(
      {
        owner: { type: "agent-thread", id: threadId },
        runtimeConfigId: selected.id,
        cwd,
        model,
        reasoningEffort,
        speed,
        firstOutputTimeoutMs:
          firstOutputTimeoutSeconds === undefined ? undefined : firstOutputTimeoutSeconds * 1000,
        systemPrompt: prompts.systemPrompt,
        prompt: resumeFromRunId ? message : prompts.prompt,
        rebuildPrompt: prompts.prompt,
        resumeFromRunId,
        permissionMode: "full-access",
        networkAccess: true,
        fullAccessConfirmed: true,
        allowedTools: mcpToolNames,
        controlMode: true,
        controlScopes: [...CONTROL_SCOPES],
      },
      (runId) => {
        const capability = agentRunCapabilityStore.mint({
          runId,
          threadId,
          scopes: CONTROL_SCOPES,
          tools: listAgentControlTools({
            audience: "internal-run",
            scopes: new Set(CONTROL_SCOPES),
          }).map((tool) => tool.name),
        });

        return {
          connectorInjection: {
            mcpServers: {
              [CONTROL_SERVER_KEY]: {
                type: "http" as const,
                url: `http://127.0.0.1:${port}/api/internal/agent-runs/${runId}/mcp`,
                headers: { Authorization: `Bearer ${capability.token}` },
              },
            },
            toolNames: mcpToolNames,
          },
          dispose: async () => {
            agentRunCapabilityStore.revokeRun(runId);
            retainControlCwd(cwd);
          },
          environment: {
            ...runtimeAuthEnvironment,
            HOME: isolatedHome,
            USERPROFILE: isolatedHome,
            XDG_CONFIG_HOME: join(isolatedHome, ".config"),
            CLAUDE_CONFIG_DIR: join(isolatedHome, ".claude"),
            ORDINE_AGENT_CONTROL_MODE: "1",
          },
        };
      },
    ),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (started.isErr()) {
    retainControlCwd(cwd);

    return err(started.error);
  }

  return started;
};

const FINISH_REMINDER = [
  "The previous control run changed a Canvas Change Set but omitted the required finish protocol.",
  "Inspect the active Change Set, call validate_canvas, repair only if validation requires it, then call finish_canvas_edit exactly once.",
  "Do not start unrelated work and do not answer with prose before the finish tool succeeds.",
].join("\n");

const completeControlRun = async ({
  threadId,
  runId,
  context,
  runtimeOptions,
}: {
  threadId: string;
  runId: string;
  context: z.infer<typeof AgentContextEnvelopeSchema>;
  runtimeOptions: Pick<
    z.infer<typeof StartRunSchema>,
    "model" | "reasoningEffort" | "speed" | "firstOutputTimeoutSeconds"
  >;
}) => {
  const run = await agentRunsService.wait(runId);
  if (run.resultText) {
    await agentThreadsService.addMessage({
      threadId,
      role: "assistant",
      content: run.resultText,
      context,
      runId: run.id,
    });
  }
  if (run.status !== "completed") {
    await agentControlService.rollbackDraftsForRun(
      run.id,
      run.status === "cancelled" ? "cancelled" : "failed",
    );
    const failureCode = run.errorCode ? ` [${run.errorCode}]` : "";
    const failureDetail = run.errorMessage ?? `Agent run ended with status ${run.status}.`;
    await agentThreadsService.addMessage({
      threadId,
      role: "system",
      kind: "progress",
      content: `Agent run ${run.status}${failureCode}: ${failureDetail}`,
      context,
      runId: run.id,
    });

    return;
  }
  const audit = await agentControlService.getCanvasRunCompletion(run.id);
  if (!audit.hasCanvasMutations || audit.complete) return;
  await agentThreadsService.addMessage({
    threadId,
    role: "system",
    content: "Canvas finish protocol was missing. ORDINE is resuming the native session once.",
    context,
    runId: run.id,
  });
  const reminder = await startControlRun({
    threadId,
    message: FINISH_REMINDER,
    context,
    runtimeId: run.runtimeConfigId,
    resumeFromRunId: run.id,
    ...runtimeOptions,
  });
  if (reminder.isErr()) {
    await agentControlService.rollbackDraftsForRun(run.id, "failed");
    await agentThreadsService.addMessage({
      threadId,
      role: "system",
      content: `Canvas finish reminder could not start. The draft was rolled back: ${reminder.error.message}`,
      context,
      runId: run.id,
    });

    return;
  }
  const reminderRun = await agentRunsService.wait(reminder.value.runId);
  if (reminderRun.resultText) {
    await agentThreadsService.addMessage({
      threadId,
      role: "assistant",
      content: reminderRun.resultText,
      context,
      runId: reminderRun.id,
    });
  }
  const finalAudit = await agentControlService.getCanvasRunCompletion(reminderRun.id);
  if (reminderRun.status === "completed" && finalAudit.complete) return;
  await agentControlService.rollbackDraftsForRun(run.id, "failed");
  await agentThreadsService.addMessage({
    threadId,
    role: "system",
    content:
      "Canvas finish protocol was still incomplete after one resume. ORDINE rolled back the draft.",
    context,
    runId: reminderRun.id,
  });
};

export const agentThreadsRoutes = new Hono();

agentThreadsRoutes.use("*", agentApiAuthMiddleware);

agentThreadsRoutes.use("*", async (context, next) => {
  if (context.req.path.endsWith("/capabilities") || getEnv().ORDINE_AGENT_CONTROL_ENABLED) {
    return next();
  }

  return context.json(
    { code: "AGENT_CONTROL_DISABLED", error: "ORDINE Agent Control is disabled" },
    503,
  );
});

agentThreadsRoutes.get("/capabilities", async (context) => {
  const runtimes = await agentRuntimesService.getAll();

  return context.json(
    AgentControlCapabilitiesSchema.parse({
      enabled: getEnv().ORDINE_AGENT_CONTROL_ENABLED,
      toolContractVersion: 1,
      toolCount: agentControlToolContract().length,
      runtimes: runtimes.map((runtime) => ({
        runtimeConfigId: runtime.id,
        runtime: runtime.type,
        name: runtime.name,
        ...runtimeControlSupport(runtime.type),
      })),
    }),
  );
});

agentThreadsRoutes.get("/", async (context) =>
  resultJson(context, await agentThreadsService.getAll()),
);

agentThreadsRoutes.post("/", async (context) => {
  const parsed = await validateJson(context, CreateThreadSchema);
  if (!parsed.success) return validationErrorJson(context);

  return resultJson(
    context,
    await agentThreadsService.create({
      title: parsed.data.title,
      context: parsed.data.context,
    }),
    201,
  );
});

agentThreadsRoutes.get("/:threadId", async (context) =>
  resultJson(context, await agentThreadsService.getById(context.req.param("threadId"))),
);

agentThreadsRoutes.patch("/:threadId", async (context) => {
  const parsed = await validateJson(context, UpdateThreadSchema);
  if (!parsed.success) return validationErrorJson(context);
  const threadId = context.req.param("threadId");
  const state = { result: await agentThreadsService.getById(threadId) };
  if (parsed.data.context)
    state.result = await agentThreadsService.updateContext(threadId, parsed.data.context);
  if (state.result.isOk() && parsed.data.title)
    state.result = await agentThreadsService.rename(threadId, parsed.data.title);
  if (state.result.isOk() && parsed.data.status === "archived")
    state.result = await agentThreadsService.archive(threadId);

  return resultJson(context, state.result);
});

agentThreadsRoutes.get("/:threadId/messages", async (context) =>
  resultJson(context, await agentThreadsService.getMessages(context.req.param("threadId"))),
);

agentThreadsRoutes.post("/:threadId/messages", async (context) => {
  const parsed = await validateJson(context, AddMessageSchema);
  if (!parsed.success) return validationErrorJson(context);

  return resultJson(
    context,
    await agentThreadsService.addMessage({
      threadId: context.req.param("threadId"),
      ...parsed.data,
    }),
    201,
  );
});

agentThreadsRoutes.post("/:threadId/runs", async (context) => {
  const parsed = await validateJson(context, StartRunSchema);
  if (!parsed.success) return validationErrorJson(context);
  const threadId = context.req.param("threadId");
  const threadResult = await agentThreadsService.getById(threadId);
  if (threadResult.isErr()) return resultJson(context, threadResult);
  const activeContext =
    parsed.data.context ??
    threadResult.value.activeContext ??
    AgentContextEnvelopeSchema.parse({
      route: { pathname: "/" },
      projectId: null,
      pipelineId: null,
      selectedResources: [],
      selectedNodeIds: [],
      attachments: [],
      activeRun: null,
      capturedAt: new Date().toISOString(),
    });
  if (parsed.data.context) await agentThreadsService.updateContext(threadId, parsed.data.context);
  const started = await startControlRun({ ...parsed.data, threadId, context: activeContext });
  if (started.isErr()) {
    return context.json(
      { code: "CONTROL_RUN_START_FAILED", error: started.error.message },
      started.error.message.includes("controlModeUnsupported") ? 409 : 500,
    );
  }
  await agentThreadsService.addMessage({
    threadId,
    role: "user",
    content: parsed.data.message,
    context: activeContext,
    runId: started.value.runId,
  });
  void ResultAsync.fromPromise(
    completeControlRun({
      threadId,
      runId: started.value.runId,
      context: activeContext,
      runtimeOptions: {
        model: parsed.data.model,
        reasoningEffort: parsed.data.reasoningEffort,
        speed: parsed.data.speed,
        firstOutputTimeoutSeconds: parsed.data.firstOutputTimeoutSeconds,
      },
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  ).match(
    () => undefined,
    (error) =>
      agentThreadsService.addMessage({
        threadId,
        role: "system",
        content: `Agent Control completion audit failed: ${error.message}`,
        context: activeContext,
        runId: started.value.runId,
      }),
  );

  return context.json(started.value, 202);
});

agentThreadsRoutes.get("/:threadId/runs/latest", async (context) => {
  const run = await agentRunsService.getLatestByOwner(
    "agent-thread",
    context.req.param("threadId"),
  );
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);

  return context.json(run);
});

agentThreadsRoutes.get("/:threadId/runs/:runId/events", (context) => {
  const query = new URL(context.req.url).search;

  return context.redirect(
    `/api/agent-runs/${encodeURIComponent(context.req.param("runId"))}/events${query}`,
    307,
  );
});

agentThreadsRoutes.get("/:threadId/change-sets", async (context) =>
  context.json(await agentControlService.getChangeSets(context.req.param("threadId"))),
);

agentThreadsRoutes.get("/:threadId/actions", async (context) =>
  context.json(await agentControlService.getActions(context.req.param("threadId"))),
);

agentThreadsRoutes.get("/:threadId/approvals", async (context) =>
  context.json(await agentControlService.getApprovals(context.req.param("threadId"))),
);

agentThreadsRoutes.post("/:threadId/approvals/:approvalId/approve", async (context) => {
  const threadId = context.req.param("threadId");
  const approvalId = context.req.param("approvalId");
  const approvals = await agentControlService.getApprovals(threadId);
  const owned = approvals.some((approval) => approval.id === approvalId);
  if (!owned) return context.json({ code: "APPROVAL_NOT_FOUND", error: "Approval not found" }, 404);
  const approval = await agentControlService.approve(approvalId);
  if (!approval) {
    return context.json(
      { code: "APPROVAL_NOT_PENDING", error: "Approval not found, expired, or already handled" },
      409,
    );
  }

  const resume: { runId: string | null; error: string | null } = { runId: null, error: null };
  if (approval.runId) {
    const originalRun = await agentRunsService.wait(approval.runId);
    const thread = await agentThreadsService.getById(threadId);
    const activeContext =
      thread.isOk() && thread.value.activeContext
        ? thread.value.activeContext
        : AgentContextEnvelopeSchema.parse({
            route: { pathname: "/" },
            projectId: null,
            pipelineId: null,
            selectedResources: [],
            selectedNodeIds: [],
            attachments: [],
            activeRun: null,
            capturedAt: new Date().toISOString(),
          });
    const resumeMessage = [
      `Approval ${approval.id} is confirmed.`,
      `Retry tool ${approval.toolName} exactly once with the same callId ${approval.callId}, identical arguments, and approvalRequestId ${approval.id}.`,
      "Do not perform unrelated work. Report only the actual tool result.",
    ].join("\n");
    const resumed = await startControlRun({
      threadId,
      message: resumeMessage,
      context: activeContext,
      runtimeId: originalRun.runtimeConfigId,
      resumeFromRunId: originalRun.id,
      model: originalRun.model ?? DEFAULT_CONTROL_MODEL,
      reasoningEffort: originalRun.reasoningEffort ?? DEFAULT_CONTROL_REASONING_EFFORT,
      speed: originalRun.speed ?? undefined,
    });
    if (resumed.isErr()) {
      resume.error = resumed.error.message;
      await agentThreadsService.addMessage({
        threadId,
        role: "system",
        content: `Approval was recorded, but the native session could not resume: ${resume.error}`,
        context: activeContext,
        runId: originalRun.id,
      });
    } else {
      resume.runId = resumed.value.runId;
      await agentThreadsService.addMessage({
        threadId,
        role: "system",
        content: `Approval confirmed for ${approval.toolName}; ORDINE resumed the native session for the one-time retry.`,
        context: activeContext,
        runId: resume.runId,
      });
      void ResultAsync.fromPromise(
        completeControlRun({
          threadId,
          runId: resume.runId,
          context: activeContext,
          runtimeOptions: {
            model: originalRun.model ?? DEFAULT_CONTROL_MODEL,
            reasoningEffort: originalRun.reasoningEffort ?? DEFAULT_CONTROL_REASONING_EFFORT,
            speed: originalRun.speed ?? undefined,
          },
        }),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ).match(
        () => undefined,
        (error) =>
          agentThreadsService.addMessage({
            threadId,
            role: "system",
            content: `Approved Agent Control completion audit failed: ${error.message}`,
            context: activeContext,
            runId: resume.runId,
          }),
      );
    }
  }

  return context.json({ approval, resumedRunId: resume.runId, resumeError: resume.error });
});

agentThreadsRoutes.post("/:threadId/approvals/:approvalId/reject", async (context) => {
  const threadId = context.req.param("threadId");
  const approvalId = context.req.param("approvalId");
  const approvals = await agentControlService.getApprovals(threadId);
  const owned = approvals.some((approval) => approval.id === approvalId);
  if (!owned) return context.json({ code: "APPROVAL_NOT_FOUND", error: "Approval not found" }, 404);
  const approval = await agentControlService.rejectApproval(approvalId);
  if (!approval) {
    return context.json(
      { code: "APPROVAL_NOT_PENDING", error: "Approval not found or already handled" },
      409,
    );
  }

  return context.json(approval);
});

const findOwnedChangeSet = async (threadId: string, changeSetId: string) => {
  const changeSets = await agentControlService.getChangeSets(threadId);

  return changeSets.find((changeSet) => changeSet.id === changeSetId);
};

agentThreadsRoutes.post("/:threadId/change-sets/:changeSetId/apply", async (context) => {
  const parsed = await validateJson(context, VersionSchema);
  if (!parsed.success) return validationErrorJson(context);
  const changeSet = await findOwnedChangeSet(
    context.req.param("threadId"),
    context.req.param("changeSetId"),
  );
  if (!changeSet)
    return context.json({ code: "CHANGE_SET_NOT_FOUND", error: "Change Set not found" }, 404);
  const result = await agentControlService.applyChangeSet(
    changeSet.id,
    parsed.data.expectedVersion,
  );

  return context.json(
    result,
    result.type === "applied" ? 200 : result.type === "change_set_not_found" ? 404 : 409,
  );
});

agentThreadsRoutes.post("/:threadId/change-sets/:changeSetId/reject", async (context) => {
  const changeSet = await findOwnedChangeSet(
    context.req.param("threadId"),
    context.req.param("changeSetId"),
  );
  if (!changeSet)
    return context.json({ code: "CHANGE_SET_NOT_FOUND", error: "Change Set not found" }, 404);
  const rejected = await agentControlService.rejectChangeSet(changeSet.id);

  return rejected
    ? context.json(rejected)
    : context.json({ code: "CHANGE_SET_NOT_REJECTABLE", error: "Change Set state changed" }, 409);
});

agentThreadsRoutes.post("/:threadId/change-sets/:changeSetId/revert", async (context) => {
  const parsed = await validateJson(context, VersionSchema);
  if (!parsed.success) return validationErrorJson(context);
  const changeSet = await findOwnedChangeSet(
    context.req.param("threadId"),
    context.req.param("changeSetId"),
  );
  if (!changeSet)
    return context.json({ code: "CHANGE_SET_NOT_FOUND", error: "Change Set not found" }, 404);
  const result = await agentControlService.revertChangeSet(
    changeSet.id,
    parsed.data.expectedVersion,
    changeSet.runId,
  );

  return context.json(
    result,
    result.type === "applied" ? 200 : result.type === "change_set_not_found" ? 404 : 409,
  );
});

agentThreadsRoutes.post("/:threadId/change-sets/:changeSetId/redo", async (context) => {
  const parsed = await validateJson(context, VersionSchema);
  if (!parsed.success) return validationErrorJson(context);
  const changeSet = await findOwnedChangeSet(
    context.req.param("threadId"),
    context.req.param("changeSetId"),
  );
  if (!changeSet)
    return context.json({ code: "CHANGE_SET_NOT_FOUND", error: "Change Set not found" }, 404);
  const result = await agentControlService.redoChangeSet(
    changeSet.id,
    parsed.data.expectedVersion,
    changeSet.runId,
  );

  return context.json(
    result,
    result.type === "applied" ? 200 : result.type === "change_set_not_found" ? 404 : 409,
  );
});

export const agentControlToolContract = () =>
  listAgentControlTools({ audience: "internal-run", scopes: new Set(CONTROL_SCOPES) }).map(
    toMcpToolDefinition,
  );
