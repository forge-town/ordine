import { extractJsonFromText, OperationOutputSchema } from "@repo/agent";

import type { StructuredOutputAssemblyBindings } from "../../contracts";
export const createStructuredOutputToMarkdownMethod =
  (serviceBindings: Pick<StructuredOutputAssemblyBindings, "tryParseJson">) =>
  ({ content }: { content: string }): string => {
    const parsed =
      (0, serviceBindings.tryParseJson)({ text: content }) ??
      (0, serviceBindings.tryParseJson)({ text: extractJsonFromText(content) });
    if (parsed === undefined) return content;

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "result" in parsed &&
      typeof parsed.result === "string"
    ) {
      return parsed.result;
    }

    const result = OperationOutputSchema.safeParse(parsed);
    if (!result.success) return content;

    const data = result.data;
    const lines: string[] = [];

    if (data.type === "check") {
      lines.push(`# Check Report`, "");
      lines.push(`> ${data.summary}`, "");
      lines.push(
        `| Metric | Count |`,
        `|--------|-------|`,
        `| Files scanned | ${data.stats.totalFiles} |`,
        `| Total findings | ${data.stats.totalFindings} |`,
        `| Errors | ${data.stats.errors} |`,
        `| Warnings | ${data.stats.warnings} |`,
        `| Info | ${data.stats.infos} |`,
        `| Skipped | ${data.stats.skipped} |`,
        "",
      );

      if (data.findings.length > 0) {
        lines.push(`## Findings`, "");
        for (const f of data.findings) {
          const badge = f.severity === "error" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
          const skip = f.skipped ? ` _(skipped: ${f.skipReason ?? "allowed exception"})_` : "";
          lines.push(`### ${badge} ${f.id}: ${f.message}${skip}`, "");
          lines.push(`- **File:** \`${f.file}\`${f.line ? ` (line ${f.line})` : ""}`);
          if (f.rule) lines.push(`- **Rule:** \`${f.rule}\``);
          if (f.snippet) lines.push(`- **Snippet:**`, `  \`\`\``, `  ${f.snippet}`, `  \`\`\``);
          if (f.suggestion) lines.push(`- **Suggestion:** ${f.suggestion}`);
          lines.push("");
        }
      } else {
        lines.push("## Findings", "", "No findings.", "");
      }
    } else {
      lines.push(`# Fix Report`, "");
      lines.push(`> ${data.summary}`, "");
      lines.push(
        `| Metric | Count |`,
        `|--------|-------|`,
        `| Total changes | ${data.stats.totalChanges} |`,
        `| Files modified | ${data.stats.filesModified} |`,
        `| Findings fixed | ${data.stats.findingsFixed} |`,
        `| Findings skipped | ${data.stats.findingsSkipped} |`,
        "",
      );

      if (data.changes.length > 0) {
        lines.push(`## Changes`, "");
        for (const c of data.changes) {
          lines.push(
            `- **\`${c.file}\`** [${c.action}]: ${c.description}${c.findingId ? ` (fixes ${c.findingId})` : ""}`,
          );
        }
        lines.push("");
      }

      if (data.remainingFindings.length > 0) {
        lines.push(`## Remaining Findings`, "");
        for (const f of data.remainingFindings) {
          const badge = f.severity === "error" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
          lines.push(
            `- ${badge} **${f.id}**: ${f.message} — \`${f.file}\`${f.line ? `:${f.line}` : ""}`,
          );
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  };
