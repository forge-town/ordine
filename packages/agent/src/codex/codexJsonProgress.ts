import { Result } from "neverthrow";

export interface CodexProgressUpdate {
  progressMessage?: string;
  finalMessage?: string;
}

interface CodexJsonEvent {
  type?: unknown;
  item?: {
    type?: unknown;
    text?: unknown;
  };
}

const safeJsonParse = Result.fromThrowable(
  (line: string): unknown => JSON.parse(line),
  () => null,
);

const isCodexJsonEvent = (value: unknown): value is CodexJsonEvent =>
  typeof value === "object" && value !== null;

const progressForItem = (itemType: unknown, actionNumber: number): string | undefined => {
  switch (itemType) {
    case "command_execution":
      return `[Codex] Inspecting the workspace (action ${actionNumber})...`;
    case "mcp_tool_call":
      return `[Codex] Using an assigned tool (action ${actionNumber})...`;
    case "web_search":
      return `[Codex] Checking external context (action ${actionNumber})...`;
    case "file_change":
      return `[Codex] Preparing workspace changes (action ${actionNumber})...`;
    default:
      return undefined;
  }
};

export const createCodexJsonProgressParser = () => {
  let bufferedLine = "";
  let actionCount = 0;

  const parseLine = (line: string): CodexProgressUpdate | undefined => {
    const parsed = safeJsonParse(line.trim());
    if (parsed.isErr() || !isCodexJsonEvent(parsed.value)) return undefined;

    const event = parsed.value;
    if (event.type === "turn.started") {
      return { progressMessage: "[Codex] Analyzing inputs and planning the step..." };
    }

    if (event.type === "turn.completed") {
      return { progressMessage: "[Codex] Finalizing the result..." };
    }

    if (event.type !== "item.started" && event.type !== "item.completed") return undefined;

    if (event.item?.type === "agent_message" && typeof event.item.text === "string") {
      return { finalMessage: event.item.text };
    }

    if (event.type === "item.completed" && event.item?.type === "reasoning") {
      return { progressMessage: "[Codex] Reviewing the gathered context..." };
    }

    if (event.type !== "item.started") return undefined;

    const progressMessage = progressForItem(event.item?.type, actionCount + 1);
    if (!progressMessage) return undefined;
    actionCount += 1;

    return { progressMessage };
  };

  const parseCompleteLines = (): CodexProgressUpdate[] => {
    const lines = bufferedLine.split(/\r?\n/);
    bufferedLine = lines.pop() ?? "";

    return lines
      .map(parseLine)
      .filter((update): update is CodexProgressUpdate => update !== undefined);
  };

  return {
    push(chunk: string): CodexProgressUpdate[] {
      bufferedLine += chunk;

      return parseCompleteLines();
    },
    flush(): CodexProgressUpdate[] {
      const updates = parseCompleteLines();
      const trailingUpdate = bufferedLine.trim() ? parseLine(bufferedLine) : undefined;
      bufferedLine = "";

      return trailingUpdate ? [...updates, trailingUpdate] : updates;
    },
  };
};
