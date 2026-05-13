import JSZip from "jszip";
import type { Operation, OperationOutputItemTemplate, OutputItem } from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";

/**
 * Map DB acceptedObjectTypes array to OPERATION.md `input` field.
 * "project" in DB corresponds to "github-project" in OPERATION.md.
 */
const mapInputField = (types: readonly string[]): string | undefined => {
  const allTypes = ["file", "folder", "project", "prompt"];
  if (types.length === 0 || types.length === allTypes.length) return undefined;
  if (types.length === 1) {
    return types[0] === "project" ? "github-project" : types[0];
  }

  return "any";
};

const CONTENT_TYPE_EXT: Record<string, string> = {
  markdown: "md",
  json: "json",
  yaml: "yaml",
  text: "txt",
  html: "html",
  xml: "xml",
  csv: "csv",
};

/**
 * Infer a filename for an output item.
 * If the name already has an extension, keep it.
 * Otherwise use the output item's selected content type.
 */
const inferOutputFilename = (output: OutputItem): string => {
  if (output.name.includes(".")) return output.name;

  const ext = CONTENT_TYPE_EXT[output.contentType] ?? "md";

  return `${output.name}.${ext}`;
};

export const toOperationMd = (op: Operation): string => {
  const lines: string[] = ["---"];
  lines.push(`name: ${op.name}`);
  lines.push(`description: ${op.description ?? ""}`);

  const input = mapInputField(op.acceptedObjectTypes);
  if (input) {
    lines.push(`input: ${input}`);
  }

  lines.push("---", "");
  lines.push(`# ${op.name}`, "");

  const prompt = op.config.executor?.systemPrompt ?? op.config.executor?.prompt ?? "";
  if (prompt) {
    lines.push(prompt, "");
  }

  if (op.config.outputs.length > 0) {
    lines.push("## Outputs", "");
    for (const output of op.config.outputs) {
      const filename = inferOutputFilename(output);
      const desc = output.description ?? output.name;
      lines.push(`- **${filename}**: ${desc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

export const exportOperation = async (op: Operation) => {
  const slug = op.name.replaceAll(/\s+/g, "-").toLowerCase();
  const zip = new JSZip();
  const folder = zip.folder(slug);
  if (!folder) return;

  // Fetch all templates first so we can infer proper extensions
  const allTemplateIds = op.config.outputs.flatMap((o) => o.templateIds);
  const templateMap = new Map<string, OperationOutputItemTemplate>();

  if (allTemplateIds.length > 0) {
    const templateResults = await Promise.all(
      allTemplateIds.map((id) =>
        dataProvider.getOne!<OperationOutputItemTemplate>({
          resource: ResourceName.operationOutputItemTemplates,
          id,
        }).then((r) => r.data),
      ),
    );
    for (const tpl of templateResults) {
      if (tpl) templateMap.set(tpl.id, tpl);
    }
  }

  folder.file("OPERATION.md", toOperationMd(op));

  // Write output-to-template mapping if any outputs have templateIds
  const hasTemplates = op.config.outputs.some((o) => o.templateIds.length > 0);
  if (hasTemplates) {
    const outputsMeta = op.config.outputs.map((o) => {
      return {
        name: inferOutputFilename(o),
        templateIds: o.templateIds,
      };
    });
    folder.file("_outputs.json", JSON.stringify(outputsMeta, null, 2));
  }

  // Write template files
  if (templateMap.size > 0) {
    const templatesFolder = folder.folder("templates");
    if (templatesFolder) {
      for (const tpl of templateMap.values()) {
        const ext = CONTENT_TYPE_EXT[tpl.contentType] ?? "txt";
        templatesFolder.file(`${tpl.id}.${ext}`, tpl.content);
      }
      const meta = [...templateMap.values()].map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        contentType: tpl.contentType,
      }));
      templatesFolder.file("_meta.json", JSON.stringify(meta, null, 2));
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.operation.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
