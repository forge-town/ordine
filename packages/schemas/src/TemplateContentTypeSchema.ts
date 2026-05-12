import { z } from "zod/v4";

export const TemplateContentTypeSchema = z.enum([
  "markdown",
  "json",
  "yaml",
  "text",
  "html",
  "xml",
  "csv",
]);
export type TemplateContentType = z.infer<typeof TemplateContentTypeSchema>;
