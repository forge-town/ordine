import { Result } from "neverthrow";

type PlanningPreviewMode = "edit" | "generate";
type PreviewField = "purpose" | "question" | "summary";

const fieldsForMode = (mode: PlanningPreviewMode): readonly PreviewField[] =>
  mode === "generate" ? ["question", "purpose"] : ["question", "summary"];

const safeJsonStringParse = Result.fromThrowable(
  (candidate: string) => JSON.parse(`"${candidate}"`) as string,
  () => undefined,
);

const stripTrailingBackslashes = (value: string): string =>
  value.endsWith("\\") ? stripTrailingBackslashes(value.slice(0, -1)) : value;

const decodePartialJsonString = (raw: string): string => {
  const candidate = stripTrailingBackslashes(raw);
  const direct = safeJsonStringParse(candidate);
  if (direct.isOk()) {
    return direct.value;
  }

  const lastEscape = candidate.lastIndexOf("\\");
  if (lastEscape < 0) {
    return "";
  }

  const trimmed = safeJsonStringParse(candidate.slice(0, lastEscape));

  return trimmed.isOk() ? trimmed.value : "";
};

const skipWhitespace = (source: string, index: number): number =>
  /\s/.test(source[index] ?? "") ? skipWhitespace(source, index + 1) : index;

const countTrailingBackslashes = (source: string, index: number): number =>
  index >= 0 && source[index] === "\\" ? countTrailingBackslashes(source, index - 1) + 1 : 0;

const findUnescapedQuoteEnd = (source: string, startIndex: number): number => {
  const index = source.indexOf('"', startIndex);
  if (index < 0) {
    return source.length;
  }

  if (countTrailingBackslashes(source, index - 1) % 2 === 1) {
    return findUnescapedQuoteEnd(source, index + 1);
  }

  return index;
};

const extractFieldPrefix = (source: string, fields: readonly PreviewField[]): string | null => {
  const allowedFields = new Set(fields);
  const state = { index: 0, selected: null as { start: number; valueStart: number } | null };

  while (state.index < source.length && !state.selected) {
    if (source[state.index] !== '"') {
      state.index += 1;
      continue;
    }

    const keyStart = state.index + 1;
    const keyEnd = findUnescapedQuoteEnd(source, keyStart);
    if (keyEnd >= source.length) {
      break;
    }

    const key = decodePartialJsonString(source.slice(keyStart, keyEnd));
    const valueStartBefore = skipWhitespace(source, keyEnd + 1);
    if (!allowedFields.has(key as PreviewField) || source[valueStartBefore] !== ":") {
      state.index = keyEnd + 1;
      continue;
    }

    const valueStart = skipWhitespace(source, valueStartBefore + 1);
    if (source[valueStart] === '"') {
      state.selected = { start: state.index, valueStart: valueStart + 1 };
      break;
    }

    state.index = keyEnd + 1;
  }

  if (!state.selected) {
    return null;
  }

  const valueEnd = findUnescapedQuoteEnd(source, state.selected.valueStart);

  return decodePartialJsonString(source.slice(state.selected.valueStart, valueEnd));
};

export const createPlanningPreviewStreamer = (input: {
  mode: PlanningPreviewMode;
  onText: (text: string) => void;
}) => {
  const fields = fieldsForMode(input.mode);
  const state = { source: "", emitted: "" };

  const push = (text: string) => {
    state.source += text;
    const preview = extractFieldPrefix(state.source, fields);
    if (!preview || !preview.startsWith(state.emitted)) {
      return;
    }

    const delta = preview.slice(state.emitted.length);
    state.emitted = preview;
    if (delta.length > 0) {
      input.onText(delta);
    }
  };

  return { push };
};
