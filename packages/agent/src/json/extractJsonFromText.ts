import { Result } from "neverthrow";

/**
 * 从可能含 markdown 围栏或周围散文的文本中提取 JSON（H1-02 自 claude 适配器迁出）。
 * 顺序：直接解析 → 围栏代码块 → 首个 `{...}` 子串。命中即返回 2 空格缩进的规范化 JSON 串；
 * 全部失败则返回 trim 后的原文。runtime 无关，是所有 LLM 结构化输出消费方的共享工具。
 */
const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => "invalid JSON",
);

export const extractJsonFromText = (text: string): string => {
  const trimmed = text.trim();

  const direct = safeJsonParse(trimmed);
  if (direct.isOk()) return JSON.stringify(direct.value, null, 2);

  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(trimmed);
  if (fenceMatch?.[1]) {
    const fenced = safeJsonParse(fenceMatch[1].trim());
    if (fenced.isOk()) return JSON.stringify(fenced.value, null, 2);
  }

  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.slice(braceStart, braceEnd + 1);
    const braced = safeJsonParse(candidate);
    if (braced.isOk()) return JSON.stringify(braced.value, null, 2);
  }

  return trimmed;
};
