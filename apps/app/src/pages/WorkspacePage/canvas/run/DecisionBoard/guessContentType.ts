import type { TemplateContentType } from "@repo/schemas";

/**
 * 候选内容尚无一等 contentType 元数据（一等文件集模型延后），按正文形态粗猜，
 * 让 ArtifactPreview 给出合理预览（html 走 iframe，json 走等宽，其余按 markdown）。
 */
export const guessContentType = (content: string): TemplateContentType => {
  const head = content.trimStart();
  if (head.startsWith("<")) return "html";
  if (head.startsWith("{") || head.startsWith("[")) return "json";

  return "markdown";
};
