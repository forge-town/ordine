import { TRACE_MARKER } from "@repo/schemas";

import type { PromptExecutorAssemblyBindings } from "../../contracts";

import { createPromptExecutorParseUserActionRequestHelper } from "../promptExecutorParseUserActionRequest";
import { createPromptExecutorBuildRuntimeContextSectionHelper } from "../promptExecutorBuildRuntimeContextSection";
import { createPromptExecutorBuildSystemPromptHelper } from "../promptExecutorBuildSystemPrompt";
import { createPromptExecutorBuildOutputItemsSectionHelper } from "../promptExecutorBuildOutputItemsSection";

import { createPromptExecutorRunMethod } from "../../methods/promptExecutorRun";
const createPromptExecutorAssembly = () => {
  const serviceBindings: PromptExecutorAssemblyBindings = {
    get PROMPT_AGENT_ID(): PromptExecutorAssemblyBindings["PROMPT_AGENT_ID"] {
      return PROMPT_AGENT_ID;
    },
    get USER_ACTION_SECTION() {
      return USER_ACTION_SECTION;
    },
    get parseUserActionRequest() {
      return parseUserActionRequest;
    },
    get DOWNSTREAM_DATA_CONTRACT_SECTION() {
      return DOWNSTREAM_DATA_CONTRACT_SECTION;
    },
    get buildRuntimeContextSection() {
      return buildRuntimeContextSection;
    },
    get buildSystemPrompt() {
      return buildSystemPrompt;
    },
    get buildOutputItemsSection() {
      return buildOutputItemsSection;
    },
    get run() {
      return run;
    },
  };

  const PROMPT_AGENT_ID = "prompt-executor";

  /**
   * Instruct the executor to emit a structured user-action marker when it cannot
   * finish because of missing user-side configuration. The marker line flows into
   * job_traces via onProgress, where the frontend renders an interactive card.
   */
  const USER_ACTION_SECTION = [
    "",
    "## When user-side configuration is missing",
    "If you cannot fully complete the task because something only the USER can provide is missing",
    "(e.g. an input folder is not configured or empty, an output destination is unknown, credentials are required),",
    "emit ONE line in this exact format on its own line, then still produce the best partial result you can:",
    `${TRACE_MARKER.userAction}{"kind":"configure-input","message":"<one short sentence telling the user what to configure>","field":"<optional missing field>"}`,
    'Allowed "kind" values: "configure-input", "configure-output", "provide-info".',
    "Do NOT emit the marker when nothing is missing.",
    "",
  ].join("\n");

  const parseUserActionRequest = createPromptExecutorParseUserActionRequestHelper(serviceBindings);

  const DOWNSTREAM_DATA_CONTRACT_SECTION = [
    "",
    "## Downstream data contract",
    "Your entire response becomes the only content passed to the next Pipeline node.",
    "Never refer to prior content as attached, provided above, or available from an earlier step while omitting that content from your response.",
    "When this Operation organizes, revises, validates, corrects, formats, or exports an artifact, return the COMPLETE resulting artifact, not only an outline, summary, change list, validation report, or instructions for reconstructing it.",
    "If a report is also required, include it after the complete artifact unless the Operation explicitly asks for a report only.",
    "Do not replace usable input content with placeholders such as TBD, pending, omitted, or to be supplied.",
    "",
  ].join("\n");

  const buildRuntimeContextSection =
    createPromptExecutorBuildRuntimeContextSectionHelper(serviceBindings);

  const buildSystemPrompt = createPromptExecutorBuildSystemPromptHelper(serviceBindings);

  const buildOutputItemsSection =
    createPromptExecutorBuildOutputItemsSectionHelper(serviceBindings);

  const run = createPromptExecutorRunMethod(serviceBindings);

  return {
    run,
  };
};

export const promptExecutor = createPromptExecutorAssembly();
