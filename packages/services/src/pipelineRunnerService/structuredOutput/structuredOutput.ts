/**
 * Structured output helpers — extract and format agent output.
 *
 * - `extractStructuredOutput` : parses LLM text → validated JSON
 * - `structuredJsonToMarkdown`: converts structured JSON → Markdown report
 */

import { z } from "zod/v4";
import { Result } from "neverthrow";
import { OperationOutputSchema } from "@repo/agent";
import { logger } from "@repo/logger";

// ─── JSON extraction ──────────────────────────────────────────────────────────

const tryParseJson = ({ text }: { text: string }): unknown | undefined => {
  const result = Result.fromThrowable(JSON.parse, () => undefined)(text);

  return result.isOk() ? (result.value as unknown) : undefined;
};

const extract = ({ rawText }: { rawText: string }): string => {
  const fenceMatch = rawText.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
  const candidate = fenceMatch?.[1]?.trim() ?? rawText.trim();

  const parsed =
    tryParseJson({ text: candidate }) ??
    (() => {
      const objectMatch = rawText.match(/\{[\s\S]*"type"\s*:\s*"(?:check|fix)"[\s\S]*\}/);
      if (objectMatch) return tryParseJson({ text: objectMatch[0] });

      return undefined;
    })();

  if (parsed === undefined) {
    logger.warn("No valid JSON found in agent output — returning raw text");

    return rawText;
  }

  const result = OperationOutputSchema.safeParse(parsed);
  if (result.success) {
    logger.info(
      {
        type: result.data.type,
        count:
          result.data.type === "check" ? result.data.findings.length : result.data.changes.length,
      },
      "Validated structured output",
    );

    return JSON.stringify(result.data, null, 2);
  }

  logger.warn(
    { error: z.prettifyError(result.error) },
    "JSON parsed but schema validation failed — returning raw text",
  );

  return rawText;
};

// ─── JSON → Markdown ──────────────────────────────────────────────────────────

const toMarkdown = ({ content }: { content: string }): string => {
  const parsed = tryParseJson({ text: content });
  if (parsed === undefined) return content;

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

export const structuredOutput = {
  extract,
  toMarkdown,
};
