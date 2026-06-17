import type { TemplateContentType } from "@repo/schemas";

export type RendererKind = "html" | "image" | "markdown" | "code" | "text";

const IMAGE_EXT_RE = /\.(svg|png|jpe?g|gif|webp|avif)$/i;
const CODE_TYPES = new Set<TemplateContentType>(["json", "yaml", "xml", "csv"]);

export const isImagePath = (path?: string): boolean => !!path && IMAGE_EXT_RE.test(path);

/** 渲染器路由：图片看扩展名（contentType 枚举无 image），其余看 contentType。 */
export const pickRenderer = (contentType: TemplateContentType, path?: string): RendererKind => {
  if (isImagePath(path)) return "image";
  if (contentType === "html") return "html";
  if (contentType === "markdown") return "markdown";
  if (CODE_TYPES.has(contentType)) return "code";

  return "text";
};

/**
 * 把工件内容转成 <img> 可用的 src。
 * SVG / data URL 可直接预览；栅格图（png/jpg…）暂无二进制服务端点，返回 null（已知缺口）。
 */
export const toImageSrc = (content: string | undefined, path?: string): string | null => {
  if (!content) return null;
  if (content.startsWith("data:")) return content;
  if ((path && /\.svg$/i.test(path)) || content.trimStart().startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }

  return null;
};
