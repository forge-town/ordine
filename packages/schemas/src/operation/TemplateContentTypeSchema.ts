import { z } from "zod/v4";

export const TEMPLATE_CONTENT_TYPE_ENUM = {
  MARKDOWN: "markdown",
  JSON: "json",
  YAML: "yaml",
  TEXT: "text",
  HTML: "html",
  XML: "xml",
  CSV: "csv",
} as const;
export const TemplateContentTypeSchema = z.enum(TEMPLATE_CONTENT_TYPE_ENUM);
export type TemplateContentType = z.infer<typeof TemplateContentTypeSchema>;
