import JSZip from "jszip";
import { ok, err, type Result } from "neverthrow";
import type { ObjectType, TemplateContentType } from "@repo/schemas";

export type ParsedTemplate = {
  id: string;
  name: string;
  description: string | null;
  contentType: TemplateContentType;
  content: string;
};

export type ParsedOperation = {
  name: string;
  description: string;
  acceptedObjectTypes: ObjectType[];
  config: {
    executor: { type: "agent"; systemPrompt: string };
    inputs: [];
    outputs: Array<{
      name: string;
      contentType: TemplateContentType;
      description: string;
      templateIds: string[];
    }>;
  };
  templates: ParsedTemplate[];
};

const INPUT_TO_OBJECT_TYPES: Record<string, ObjectType[]> = {
  file: ["file"],
  folder: ["folder"],
  "github-project": ["project"],
  prompt: ["prompt"],
  any: ["file", "folder", "project", "prompt"],
};

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  markdown: "md",
  json: "json",
  yaml: "yaml",
  text: "txt",
  html: "html",
  xml: "xml",
  csv: "csv",
};

const EXT_TO_CONTENT_TYPE: Record<string, TemplateContentType> = {
  md: "markdown",
  markdown: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  txt: "text",
  text: "text",
  html: "html",
  htm: "html",
  xml: "xml",
  csv: "csv",
};

const parseFrontmatter = (
  content: string,
): Result<{ frontmatter: Record<string, string>; body: string }, string> => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return err("Missing frontmatter (--- delimiters)");
  }
  const frontmatter: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    frontmatter[key] = value;
  }

  return ok({ frontmatter, body: match[2]! });
};

const parseOutputs = (
  body: string,
): Array<{
  name: string;
  contentType: TemplateContentType;
  description: string;
  templateIds: string[];
}> => {
  const outputsMatch = body.match(/## Outputs\n\n([\s\S]*?)(?:\n## |\n*$)/);
  if (!outputsMatch) return [];

  const matches = [...outputsMatch[1]!.matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)];

  return matches.map((m) => {
    const filename = m[1]!;
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";

    return {
      name: filename,
      contentType: EXT_TO_CONTENT_TYPE[ext] ?? "markdown",
      description: m[2]!,
      templateIds: [],
    };
  });
};

export const parseOperationMd = (content: string): Result<ParsedOperation, string> => {
  const parseResult = parseFrontmatter(content);
  if (parseResult.isErr()) return err(parseResult.error);

  const { frontmatter, body } = parseResult.value;

  if (!frontmatter.name) return err("Missing required field: name");
  if (!frontmatter.description) return err("Missing required field: description");

  const inputValue = frontmatter.input ?? "any";
  const acceptedObjectTypes = INPUT_TO_OBJECT_TYPES[inputValue] ?? INPUT_TO_OBJECT_TYPES.any!;
  const outputs = parseOutputs(body);

  // Extract the body content excluding the ## Outputs section for the system prompt
  const systemPrompt = body.replace(/## Outputs\n\n[\s\S]*?(?:\n## |\n*$)/, "").trim();

  return ok({
    name: frontmatter.name,
    description: frontmatter.description,
    acceptedObjectTypes,
    config: {
      executor: { type: "agent", systemPrompt },
      inputs: [],
      outputs,
    },
    templates: [],
  });
};

export const parseOperationZip = async (
  file: File | Blob | ArrayBuffer | Uint8Array,
): Promise<Result<ParsedOperation, string>> => {
  const zip = await JSZip.loadAsync(file);

  // Find OPERATION.md — could be at root or inside a folder
  const paths: string[] = [];
  zip.forEach((p) => {
    if (p.endsWith("OPERATION.md")) paths.push(p);
  });
  const operationMdFile = paths.length > 0 ? zip.file(paths[0]!) : null;

  if (!operationMdFile) {
    return err("No OPERATION.md found in ZIP");
  }

  const content = await operationMdFile.async("string");
  const parseResult = parseOperationMd(content);
  if (parseResult.isErr()) return parseResult;

  const parsed = parseResult.value;

  // Read output→template mapping from _outputs.json
  const operationDir = paths[0]!.replace(/OPERATION\.md$/, "");
  const outputsMetaFile = zip.file(`${operationDir}_outputs.json`);
  if (outputsMetaFile) {
    const outputsMeta = JSON.parse(await outputsMetaFile.async("string")) as Array<{
      name: string;
      templateIds: string[];
    }>;
    for (const meta of outputsMeta) {
      const output = parsed.config.outputs.find((o) => o.name === meta.name);
      if (output) {
        output.templateIds = meta.templateIds;
      }
    }
  }

  // Read templates from templates/_meta.json if present
  const metaFile = zip.file(`${operationDir}templates/_meta.json`);
  if (metaFile) {
    const metaJson = await metaFile.async("string");
    const meta = JSON.parse(metaJson) as Array<{
      id: string;
      name: string;
      description: string | null;
      contentType: TemplateContentType;
    }>;

    const templates: ParsedTemplate[] = [];
    for (const entry of meta) {
      const ext = CONTENT_TYPE_TO_EXT[entry.contentType] ?? "txt";
      const contentFile = zip.file(`${operationDir}templates/${entry.id}.${ext}`);
      const tplContent = contentFile ? await contentFile.async("string") : "";
      templates.push({ ...entry, content: tplContent });
    }
    parsed.templates = templates;
  }

  return ok(parsed);
};
